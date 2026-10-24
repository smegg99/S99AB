// web/src/composables/tabs/internal/contextMenu.ts
import { nextTick, reactive } from 'vue'

/** One line of a right-click menu: an action or a rule. */
export interface MenuEntry {
  key: string
  title?: string
  icon?: string
  /** The shortcut that does the same, as a menu writes it. */
  keys?: string
  divider?: boolean
  disabled?: boolean
  /** Localized explanation shown on hover and keyboard focus while disabled. */
  disabledReason?: string
  /** Localized detail shown on hover and focus while enabled; ignored on entries with children. */
  hint?: string
  /** A destructive action, drawn in the error colour. */
  danger?: boolean
  children?: MenuEntry[]
  run?: () => void
}

// One menu for the whole workspace, so two can never be open at once.
const menu = reactive({
  open: false,
  at: [0, 0] as [number, number],
  entries: [] as MenuEntry[],
})

export function useContextMenuState() {
  return menu
}

/** Opens the workspace menu at the pointer in place of the webview's own. */
export function openContextMenu(event: MouseEvent, entries: MenuEntry[]) {
  event.preventDefault()
  menu.open = false
  menu.at = [event.clientX, event.clientY]
  menu.entries = entries
  // Closed first, so a second right-click moves the menu.
  void nextTick(() => (menu.open = true))
}

export function closeContextMenu() {
  menu.open = false
}

/** Where the webview's own menu is still the right one: a field, or text someone selected. */
export function wantsNativeMenu(event: MouseEvent): boolean {
  const target = event.target as HTMLElement | null
  if (target?.closest('input, textarea, [contenteditable="true"]')) return true
  return !!window.getSelection()?.toString()
}
