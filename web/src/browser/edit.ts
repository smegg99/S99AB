// web/src/browser/edit.ts
/**
 * Ctrl+Z and Ctrl+Shift+Z in an editor field: revert or keep typed text, else pass to the editor's undo.
 * The field's native undo never runs: WebKit restores text from an earlier visit, which blur would save.
 */
export function undoStep(key: Pick<KeyboardEvent, 'key' | 'ctrlKey' | 'metaKey' | 'altKey' | 'shiftKey'>, typed: boolean): 'revert' | 'keep' | 'pass' | null {
  if (!(key.ctrlKey || key.metaKey) || key.altKey || key.key.toLowerCase() !== 'z') return null
  if (!typed) return 'pass'
  return key.shiftKey ? 'keep' : 'revert'
}

/** Re-dispatches an undo key from `host`, a non-field element, since the editor shortcut ignores keys typed in fields. */
export function passUndo(key: KeyboardEvent, host: Element | null | undefined) {
  host?.dispatchEvent(new KeyboardEvent('keydown', {
    key: key.key,
    ctrlKey: key.ctrlKey,
    metaKey: key.metaKey,
    shiftKey: key.shiftKey,
    bubbles: true,
    cancelable: true,
  }))
}

/**
 * Undo keys from a closed select or autocomplete go to the editor's undo once pending saves (`after`) settle.
 * An open list keeps the key for its search. Returns whether the key was taken.
 */
export function listUndo(key: KeyboardEvent, after: () => Promise<unknown>): boolean {
  if (undoStep(key, false) !== 'pass') return false
  const list = (key.target as Element | null)?.closest?.('[role="combobox"]')
  if (!list || list.getAttribute('aria-expanded') === 'true') return false
  key.preventDefault()
  key.stopPropagation()
  const host = (key.currentTarget as Element | null)?.parentElement ?? null
  const pass = () => passUndo(key, host)
  void after().then(pass, pass)
  return true
}
