// web/src/composables/primitives/useTips.ts
import { onScopeDispose, shallowRef } from 'vue'

/**
 * One tooltip for a grid: any `data-tip` element shows its text on hover. Bind with v-on.
 * Not title (see useTileNames). Hidden while a button is held and on press.
 */
export function useTips() {
  const tip = shallowRef<{ el: HTMLElement, text: string } | null>(null)

  const tipOf = (event: Event) => (event.target as HTMLElement | null)?.closest<HTMLElement>('[data-tip]') ?? null

  const on = {
    mouseover(event: MouseEvent) {
      const el = tipOf(event)
      if (el === tip.value?.el) return
      tip.value = el && !event.buttons && el.dataset.tip ? { el, text: el.dataset.tip } : null
    },
    mouseout(event: MouseEvent) {
      const el = tipOf(event)
      if (el && !el.contains(event.relatedTarget as Node | null) && tip.value?.el === el) tip.value = null
    },
    pointerdown() {
      tip.value = null
    },
  }

  onScopeDispose(() => (tip.value = null))
  return { tip, on }
}
