// web/src/composables/tabs/useTabDrag.ts
import { computed, nextTick, onScopeDispose, ref, shallowRef, watch, type Ref } from 'vue'
import type { WorkspaceTab } from './useTabs'

export interface TabStripGeometry {
  bounds: { x: number, y: number, width: number, height: number }
  tabs: { id: string, x: number, width: number, pinned: boolean }[]
}
/** How a tab dragged out of its window is drawn in the slot another window opens for it. */
export interface NativeTabFace {
  title: string
  icon: string
  tint?: string
}
/** Where the native drag saw the pointer: outside this window, or over it at x, y. */
export interface NativeTabTrack {
  inside: boolean
  x: number
  y: number
}
export interface NativeTabDrag<T extends WorkspaceTab> {
  dragging: string
  /** The slot opened for a tab dragged in from another window, and its face once known. */
  incoming: { slot: number, face?: NativeTabFace } | null
  closing: boolean
  /** Set while the native drag carries this window's tab and the page gets no pointer events. */
  track: NativeTabTrack | null
  allowed: (tab: T) => boolean
  beginDrag: (tab: T, face: NativeTabFace) => Promise<boolean>
  cancelDrag: () => void
  tearOff: (tab: T) => void
  strip: (geometry: TabStripGeometry) => void
  /** Sets the native drag image: a base64 PNG at scale, held at x, y. */
  image: (png: string, scale: number, x: number, y: number) => void
}
export interface TabWorkspace<T extends WorkspaceTab> {
  tabs: T[]
  activeId: string
  move: (id: string, slot: number) => void
  activate: (id: string) => void
  close: (id: string) => void
}

/** Tab reordering on pointer events: WebKitGTK runs HTML drag and drop only through the desktop's protocol. */
export function useTabDrag<T extends WorkspaceTab>(list: Readonly<Ref<HTMLElement | undefined>>, elements: Map<string, HTMLElement>, ws: TabWorkspace<T>, native: () => NativeTabDrag<T> | undefined, faceOf: (tab: T) => NativeTabFace) {
  let following: Promise<boolean> | undefined
  watch(() => native()?.dragging, (id, before) => {
    if (!id && before) stop(false)
  })
  watch(() => native()?.track, (track) => {
    const tab = ws.tabs.find(x => x.id === dragging.value)
    if (track && tab) follow(tab, track.x, track.y, track.inside)
  })

  const dragging = ref<string | null>(null)
  /** Landing index among the other tabs in store order, as ws.move takes it. */
  const slot = ref<number | null>(null)
  /** Whether the tabs slide to their places: through a drag, and the update that ends it. */
  const glide = ref(false)
  /** The pill under the pointer: none while the pointer is outside the window. */
  const ghost = shallowRef<{ tab: T, x: number, y: number } | null>(null)
  let press: { id: string, x: number, y: number } | null = null
  /** Set from a drop until the click that follows its pointerup has passed. */
  let dropped = false

  const shown = computed(() => {
    const tab = ws.tabs.find(x => x.id === dragging.value)
    if (!tab || slot.value === null) return ws.tabs
    const others = ws.tabs.filter(x => x !== tab)
    others.splice(slot.value, 0, tab)
    return others
  })

  function onPointerdown(event: PointerEvent, tab: T) {
    // The cross closes; a press on it is not a grab.
    if (event.button !== 0 || tab.pinned || tab.moving || (native()?.closing || native()?.allowed(tab) === false) || (event.target as Element).closest('.tab__close')) return
    press = { id: tab.id, x: event.clientX, y: event.clientY }
    window.addEventListener('pointermove', onPointermove)
    window.addEventListener('pointerup', onPointerup)
    window.addEventListener('pointercancel', cancel)
    window.addEventListener('keydown', onDragKey, true)
  }

  function onPointermove(event: PointerEvent) {
    if (!press) return
    if (!dragging.value) {
      if (Math.hypot(event.clientX - press.x, event.clientY - press.y) < 6) return
      const id = press.id
      dragging.value = id
      slot.value = ws.tabs.findIndex(x => x.id === id)
      glide.value = true
      const tab = ws.tabs.find(tab => tab.id === id)
      if (tab && native()) following = native()!.beginDrag(tab, faceOf(tab))
    }
    const tab = ws.tabs.find(x => x.id === dragging.value)
    if (!tab) {
      stop()
      return
    }
    const { clientX: x, clientY: y } = event
    follow(tab, x, y, x >= 0 && y >= 0 && x < window.innerWidth && y < window.innerHeight)
  }

  /** Outside the window the pill hides (the native drag draws its own) and the slot stays. */
  function follow(tab: T, x: number, y: number, inside: boolean) {
    ghost.value = inside ? { tab, x, y } : null
    if (inside) preview(x)
  }

  function overStrip(x: number, y: number) {
    const rect = list.value?.getBoundingClientRect()
    return !!rect && x >= rect.left && x < rect.right && y >= rect.top && y < rect.bottom
  }

  /** Moves the dragged tab before or after the tab under the pointer, by which half it is in. */
  function preview(x: number) {
    const id = dragging.value
    const strip = list.value
    if (!id || !strip) return

    // Layout offsets, not drawn rects: a sliding tab would flip the slot under a still pointer.
    const origin = strip.getBoundingClientRect().left - strip.scrollLeft
    let target: T | undefined
    let after = true
    for (const tab of shown.value) {
      const el = elements.get(tab.id)
      if (!el) continue
      const left = origin + el.offsetLeft
      target = tab
      after = x > left + el.offsetWidth / 2
      if (x < left + el.offsetWidth) break
    }
    if (!target || target.id === id) return

    const others = ws.tabs.filter(tab => tab.id !== id)
    // Nothing goes ahead of a pinned tab.
    const pinned = others.filter(tab => tab.pinned).length
    slot.value = Math.max(pinned, others.indexOf(target) + (after ? 1 : 0))
  }

  async function onPointerup(event: PointerEvent) {
    const id = dragging.value
    const to = slot.value
    const followed = following
    if (followed && await followed) return // Native drop chooses the target.
    stop()
    if (!id || to === null) return
    const tab = ws.tabs.find(tab => tab.id === id)
    if (tab && native() && list.value && !overStrip(event.clientX, event.clientY)) {
      native()!.tearOff(tab)
    }
    else {
      ws.move(id, to)
      ws.activate(id)
    }
    dropped = true
    setTimeout(() => (dropped = false))
  }

  // Keys are swallowed during a drag; Escape cancels it.
  function onDragKey(event: KeyboardEvent) {
    if (!dragging.value) return
    event.preventDefault()
    event.stopPropagation()
    if (event.key === 'Escape') stop()
  }

  function stop(cancelNative = true) {
    if (cancelNative) native()?.cancelDrag()
    following = undefined
    const was = dragging.value
    press = null
    dragging.value = null
    slot.value = null
    ghost.value = null
    window.removeEventListener('pointermove', onPointermove)
    window.removeEventListener('pointerup', onPointerup)
    window.removeEventListener('pointercancel', cancel)
    window.removeEventListener('keydown', onDragKey, true)
    // One update more with the slide on, so a cancelled drag's tabs slide back.
    if (was) void nextTick(() => (glide.value = false))
  }

  const cancel = () => stop()
  onScopeDispose(cancel)

  return {
    shown,
    dragging,
    glide,
    ghost,
    onPointerdown,
    /** Whether the click now arriving ends a drop, which has already answered it. */
    wasDropped: () => dropped,
  }
}
