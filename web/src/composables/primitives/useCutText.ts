// web/src/composables/primitives/useCutText.ts
import { onScopeDispose, shallowRef } from 'vue'

import { isCut } from './internal/text'

/** Tooltip with the whole text of cut elements matching `selector` in a pane (bound with v-on, drawn from `tip`). */
export function useCutText(selector: string, delay = 0) {
  const tip = shallowRef<{ el: HTMLElement, text: string } | null>(null)
  let timer: ReturnType<typeof setTimeout> | undefined
  let pending: HTMLElement | null = null

  function hide() {
    clearTimeout(timer)
    pending = null
    tip.value = null
  }

  const on = {
    mouseover(event: MouseEvent) {
      const el = (event.target as HTMLElement | null)?.closest<HTMLElement>(selector)
      if (!el || el === pending || el === tip.value?.el || event.buttons) return
      hide()
      if (!isCut(el)) return
      pending = el
      const text = el instanceof HTMLInputElement ? el.value : el.textContent?.trim() ?? ''
      timer = setTimeout(() => (tip.value = { el, text }), delay)
    },
    mouseout(event: MouseEvent) {
      const el = (event.target as HTMLElement | null)?.closest<HTMLElement>(selector)
      if (!el || el.contains(event.relatedTarget as Node | null)) return
      if (pending === el || tip.value?.el === el) hide()
    },
    pointerdown: hide,
  }

  onScopeDispose(hide)
  return { tip, on }
}
