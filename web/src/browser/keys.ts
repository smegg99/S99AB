// web/src/browser/keys.ts

/** A pick's modifiers: ctrl is Ctrl or Cmd, so the same gesture works on every OS. */
export interface PickMods {
  ctrl: boolean
  shift: boolean
}

export function pickMods(event: MouseEvent | KeyboardEvent): PickMods {
  return { ctrl: event.ctrlKey || event.metaKey, shift: event.shiftKey }
}
