// web/src/composables/primitives/useTextWidth.ts
import { onScopeDispose, shallowRef, watch, type Ref } from 'vue'
import { wordsRoom } from './internal/text'

/** Measures an intrinsic text probe without WebKit's fractional-width ellipsis loss. */
export function useTextWidth(probe: Ref<HTMLElement | null>) {
  const width = shallowRef<number | null>(null)
  if (typeof ResizeObserver === 'undefined') return width
  const observer = new ResizeObserver(() => {
    const measured = probe.value?.getBoundingClientRect().width ?? 0
    width.value = measured ? wordsRoom(measured) : null
  })
  watch(probe, (el, was) => {
    if (was) observer.unobserve(was)
    if (el) observer.observe(el)
  }, { immediate: true, flush: 'post' })
  onScopeDispose(() => observer.disconnect())
  return width
}
