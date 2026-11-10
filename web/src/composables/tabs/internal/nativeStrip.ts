// web/src/composables/tabs/internal/nativeStrip.ts

import { computed, nextTick, onMounted, onScopeDispose, watch, type Ref } from 'vue'
import { drawChip } from './drawChip'
import type { WorkspaceTab } from '../useTabs'
import type { NativeTabDrag } from './tabDrag'

/** The id of the gap a tab from another window opens while it hovers. */
export const INCOMING = 'incoming-native-tab'

/** What the strip lends the bridge: its list, its tab elements and what it shows. */
export interface NativeStripHost<T extends WorkspaceTab> {
  native: () => NativeTabDrag<T> | undefined
  list: Readonly<Ref<HTMLElement | undefined>>
  elements: Map<string, HTMLElement>
  shown: Readonly<Ref<T[]>>
  titleOf: (tab: T) => string
  /** Whether a tab from another window would land here if dropped now. */
  dropping: Ref<boolean>
  /** While dropping, the slot's span from the strip's left edge. */
  dropSlot: Ref<{ left: number, width: number } | null>
  /** The pill under the pointer, drawn once per drag as the native drag image. */
  ghost: Readonly<Ref<HTMLElement | null>>
  /** Pointer offset into the pill, matching the drag image. */
  grab: number
}

/** The strip's side of a cross-window tab drag: the incoming gap, the drag image and the reported geometry. */
export function useNativeStrip<T extends WorkspaceTab>(host: NativeStripHost<T>) {
  const incomingFace = computed(() => host.native()?.incoming?.face)
  let slotFrame = 0

  function nameOf(tab: T) {
    return tab.id === INCOMING ? incomingFace.value?.title ?? '' : host.titleOf(tab)
  }

  onMounted(() => watch(() => !!host.native()?.incoming, (on) => {
    host.dropping.value = on
    cancelAnimationFrame(slotFrame)
    if (on) slotFrame = requestAnimationFrame(measureSlot)
    else host.dropSlot.value = null
  }, { immediate: true }))

  // Measured every frame while dropping: the slot slides and the strip scrolls.
  function measureSlot() {
    const el = host.elements.get(INCOMING)
    const list = host.list.value
    const strip = list?.parentElement
    let next: { left: number, width: number } | null = null
    if (el && strip && list) {
      const origin = strip.getBoundingClientRect().left
      const view = list.getBoundingClientRect()
      const box = el.getBoundingClientRect()
      const left = Math.max(box.left, view.left)
      const right = Math.min(box.right, view.right)
      if (right > left) next = { left: Math.round(left - origin), width: Math.round(right - left) }
    }
    const was = host.dropSlot.value
    if (next?.left !== was?.left || next?.width !== was?.width) host.dropSlot.value = next
    slotFrame = requestAnimationFrame(measureSlot)
  }

  let pictured = ''
  watch(host.ghost, (el) => {
    const native = host.native()
    const id = native?.dragging
    if (!el || !id || pictured === id) return
    pictured = id
    const scale = Math.max(1, Math.ceil(window.devicePixelRatio || 1))
    const png = drawChip(el, scale)
    if (png) native?.image(png, scale, host.grab, host.grab)
  }, { flush: 'post' })

  const displayed = computed(() => {
    const tabs = [...host.shown.value]
    const incoming = host.native()?.incoming
    if (incoming) tabs.splice(incoming.slot, 0, { id: INCOMING } as T)
    return tabs
  })

  // Describe layout coordinates, excluding the incoming gap and transforms.
  let observer: ResizeObserver | undefined
  let frame = 0
  function queueStrip() {
    cancelAnimationFrame(frame)
    frame = requestAnimationFrame(() => {
      const el = host.list.value
      const native = host.native()
      if (!el || !native) return
      const bounds = el.getBoundingClientRect()
      const gap = host.elements.get(INCOMING)
      const gapWidth = gap ? gap.offsetWidth + 2 : 0
      const tabs = host.shown.value.flatMap((tab) => {
        const item = host.elements.get(tab.id)
        if (!item) return []
        const shift = gap && item.offsetLeft > gap.offsetLeft ? gapWidth : 0
        return [{ id: tab.id, x: Math.round(bounds.left + item.offsetLeft - el.scrollLeft - shift), width: item.offsetWidth, pinned: !!tab.pinned }]
      })
      native.strip({ bounds: { x: Math.round(bounds.left), y: Math.round(bounds.top), width: Math.round(bounds.width), height: Math.round(bounds.height) }, tabs })
    })
  }
  onMounted(() => {
    observer = new ResizeObserver(queueStrip)
    const list = host.list.value
    if (list) {
      observer.observe(list)
      list.addEventListener('scroll', queueStrip)
    }
    queueStrip()
  })
  watch(displayed, () => {
    void nextTick(queueStrip)
  }, { deep: true })
  onScopeDispose(() => {
    observer?.disconnect()
    if (typeof cancelAnimationFrame !== 'undefined') {
      cancelAnimationFrame(frame)
      cancelAnimationFrame(slotFrame)
    }
    host.list.value?.removeEventListener('scroll', queueStrip)
  })

  return { incomingFace, nameOf, displayed }
}
