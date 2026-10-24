// web/src/composables/primitives/internal/opener.ts

// The opener of a dialog or menu and whether a key opened it, so focus can return.
// Shared by useDialog and UiWorkspaceMenu.

let keyed = false
if (typeof window !== 'undefined') {
  window.addEventListener('pointerdown', () => (keyed = false), true)
  window.addEventListener('keydown', () => (keyed = true), true)
}

/** Whether the last press was a key, not a pointer. */
export function pressedByKey(): boolean {
  return keyed
}

/** The element holding the focus, unless that is nothing or the page itself. */
export function focused(): HTMLElement | null {
  if (typeof document === 'undefined') return null
  const el = document.activeElement
  return el instanceof HTMLElement && el !== document.body ? el : null
}
