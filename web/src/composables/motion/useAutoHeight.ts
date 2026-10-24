// web/src/composables/motion/useAutoHeight.ts

import {
  onBeforeUnmount,
  onBeforeUpdate,
  onMounted,
  onUpdated,
  ref,
  watch,
  type ShallowRef,
} from 'vue'
import { useMotion } from './useMotion'

type ElementRef = Readonly<ShallowRef<HTMLElement | null>>

/** The base duration when the element cannot be read. Matches `$motion-base` in _config.scss. */
const FALLBACK_MS = 200

/**
 * Measures `content` and reports the height its box should take, so size
 * changes can transition. `ghost` holds the outgoing content while the box closes.
 */
export function useAutoHeight(content: ElementRef, ghost: ElementRef) {
  const { resolved } = useMotion()

  const height = ref<number | null>(null)
  const holding = ref(false)

  let observer: ResizeObserver | undefined
  let ghostTimer: ReturnType<typeof setTimeout> | undefined

  // Height and content before the patch; afterwards the outgoing nodes are gone.
  let pending: number | null = null
  let outgoing: Node | null = null

  onBeforeUpdate(() => {
    pending = height.value
    outgoing = animates() && content.value ? content.value.cloneNode(true) : null
  })

  onUpdated(() => {
    const before = pending
    const copy = outgoing
    pending = null
    outgoing = null
    if (before === null) return

    measure()
    // Only a shrink needs the copy; growth is revealed through the clip.
    if (!copy || height.value === null || height.value >= before) return

    holdOutgoing(copy, before)
    if (ghostTimer) clearTimeout(ghostTimer)
    ghostTimer = setTimeout(dropGhost, durationMs())
  })

  onMounted(() => {
    measure()
    if (typeof ResizeObserver === 'undefined') return

    observer = new ResizeObserver(() => measure())
    if (content.value) observer.observe(content.value)
  })

  onBeforeUnmount(() => {
    observer?.disconnect()
    if (ghostTimer) clearTimeout(ghostTimer)
  })

  // Reduced motion: the box resizes immediately.
  watch(
    resolved,
    (level) => {
      if (level === 'off' || level === 'reduced') {
        height.value = null
        dropGhost()
      }
      else measure()
    },
    { immediate: true },
  )

  function measure() {
    const el = content.value
    if (!el) return
    // Rounded up, so no hairline of leaving content shows under the box.
    height.value = Math.ceil(el.getBoundingClientRect().height)
  }

  function animates(): boolean {
    return resolved.value !== 'off' && resolved.value !== 'reduced'
  }

  // Vue removes leaving nodes before the box moves, so a copy of them is laid
  // over the box and clipped away as it closes. The originals belong to Vue.
  function holdOutgoing(copy: Node, was: number) {
    const layer = ghost.value
    if (!layer) return

    layer.replaceChildren(copy)
    layer.style.height = `${was}px`
    holding.value = true
  }

  function dropGhost() {
    holding.value = false
    ghost.value?.replaceChildren()
  }

  /** A CSS duration in milliseconds, or null where it says nothing usable. */
  function toMs(raw: string): number | null {
    const value = raw.trim()
    if (!value) return null

    const ms = value.endsWith('ms')
      ? Number.parseFloat(value)
      : Number.parseFloat(value) * 1000
    return Number.isFinite(ms) && ms > 0 ? ms : null
  }

  // The computed transition duration, which may come from a preset's CSS or the
  // prop, so the copy is dropped when the box finishes closing.
  function durationMs(): number {
    const el = ghost.value
    if (typeof getComputedStyle === 'undefined' || !el) return FALLBACK_MS

    const style = getComputedStyle(el)
    return (
      toMs(style.getPropertyValue('--autoheight-duration'))
      ?? toMs(style.getPropertyValue('--s99ab-motion-base'))
      ?? FALLBACK_MS
    )
  }

  return { height, holding, measure }
}
