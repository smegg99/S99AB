// web/src/composables/primitives/internal/text.ts

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

/** Sizes an inline run from its children with room for WebKit's fractional glyph advances. */
export function fitWordRun(el: HTMLElement) {
  const first = el.firstElementChild
  const last = el.lastElementChild
  const width = first && last ? last.getBoundingClientRect().right - first.getBoundingClientRect().left : 0
  el.style.width = width > 0 ? `${wordsRoom(width)}px` : ''
}
