// web/src/composables/primitives/internal/opener.ts

// The opener of a dialog or menu, so focus can return. Shared by useDialog and UiWorkspaceMenu.

/** The element holding the focus, unless that is nothing or the page itself. */
export function focused(): HTMLElement | null {
  if (typeof document === 'undefined') return null
  const el = document.activeElement
  return el instanceof HTMLElement && el !== document.body ? el : null
}
