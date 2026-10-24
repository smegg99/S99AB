// web/src/browser/focus.ts

/**
 * Moves the focus out and back on Shift+Tab, so WebKit starts the search from the focused control instead of
 * the clicked child node. WebKitGTK reports the key as "Unidentified"; its code is still Tab.
 */
export function focusStart() {
  /** The node the last mouse press landed on, while it is inside the focused control. */
  let pressed: Node | null = null

  return {
    mousedown(event: MouseEvent) {
      pressed = event.target as Node | null
    },
    focusin(event: FocusEvent) {
      const target = event.target as Node | null
      if (pressed && !target?.contains(pressed)) pressed = null
    },
    keydown(event: KeyboardEvent) {
      // WebKitGTK names ISO_Left_Tab Unidentified; downstream focus traps need the actual key.
      if (event.code === 'Tab' && event.key === 'Unidentified') Object.defineProperty(event, 'key', { value: 'Tab', configurable: true })
      if (!pressed || event.defaultPrevented || !event.shiftKey || event.ctrlKey || event.altKey || event.metaKey) return
      if (event.code !== 'Tab' && event.key !== 'Tab') return
      // A key goes to the focused element, or to the body when nothing has
      // the focus; then WebKit goes on from the press, as it should.
      const control = event.target as HTMLElement | null
      if (!control || control === control.ownerDocument?.body || control === pressed || !control.contains(pressed)) return
      // An editable control already starts from itself.
      if (control.isContentEditable) return
      pressed = null
      control.blur()
      control.focus({ preventScroll: true })
    },
  }
}

/** Whether native or roving keyboard focus gives an element a visible ring. */
export function hasFocusRing(el: HTMLElement | null | undefined): boolean {
  return !!el && (el.matches(':focus-visible') || !!el.closest?.('[data-s99ab-keyed]'))
}
