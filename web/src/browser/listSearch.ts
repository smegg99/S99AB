// web/src/browser/listSearch.ts

/** The search of a list field the focus went to (Vuetify's autocomplete or combobox), or null for any other element. */
function searchOf(target: EventTarget | null): HTMLInputElement | null {
  const el = target as (HTMLInputElement & { closest?: Element['closest'] }) | null
  if (!el || el.tagName !== 'INPUT' || !el.closest?.('.v-autocomplete, .v-combobox')) return null
  return el
}

const MODIFIERS = new Set(['Shift', 'Control', 'Alt', 'Meta'])

/**
 * Selects a list field's value on focus, so typing starts a new search; after a focusing press, once its button comes up.
 * A press whose release is never seen ends at the next key, drag end, cancelled pointer or window blur.
 */
export function listSearch(later: (run: () => void) => void = run => setTimeout(run)) {
  let pressing = false
  /** The search the press now down gave the focus to. */
  let pressed: HTMLInputElement | null = null
  function lost() {
    pressing = false
    pressed = null
  }

  return {
    mousedown() {
      pressing = true
    },
    focusin(event: FocusEvent) {
      const search = searchOf(event.target)
      if (!search) return
      if (pressing) pressed = search
      else search.select()
    },
    mouseup() {
      const search = pressed
      pressing = false
      pressed = null
      if (search) later(() => search.ownerDocument.activeElement === search && search.select())
    },
    /** A drag's end, a cancelled pointer or the window's blur: no press is down any more. */
    lost,
    /** A key other than a modifier held for a click: no press is down any more. */
    keydown(event: Pick<KeyboardEvent, 'key'>) {
      if (!MODIFIERS.has(event.key)) lost()
    },
  }
}
