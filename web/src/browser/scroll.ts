// web/src/browser/scroll.ts
/** Whether vertical overflow exceeds layout rounding. */
export function scrollsDown(el: Pick<HTMLElement, 'scrollHeight' | 'clientHeight'>): boolean {
  return el.scrollHeight > el.clientHeight + 1
}
