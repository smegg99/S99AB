// web/src/composables/primitives/useCutText.ts
import { onScopeDispose, shallowRef } from 'vue'

/** A line's words, each an inline-block box so a cut line ends in "..." after a whole word; a no-break space joins words. */
export function cutWords(text: string): string[] {
  return text.split(' ').filter(Boolean)
}

/** A line's words as kit/Words.vue draws them: each boxed except the first, so an over-wide first word is cut instead of lost;
 * `follows` boxes the first too. */
export function wordBoxes(text: string, follows = false): { word: string, box: boolean }[] {
  return cutWords(text).map((word, at) => ({ word, box: follows || at > 0 }))
}

/** Width for a box of word boxes (cutWords) to show its line whole: measured, rounded up, plus 1px.
 * Sized by its words alone, WebKitGTK makes it a fraction too narrow and the ellipsis takes the last word. */
export function wordsRoom(width: number): number {
  return Math.ceil(width) + 1
}

/** Whether an element's text is cut short: wider than its box, or taller for a line clamp (`data-lines`). */
export function isCut(el: Pick<HTMLElement, 'scrollWidth' | 'clientWidth' | 'scrollHeight' | 'clientHeight'> & { dataset?: DOMStringMap }): boolean {
  return el.scrollWidth > el.clientWidth || (el.dataset?.lines !== undefined && el.scrollHeight > el.clientHeight)
}

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
