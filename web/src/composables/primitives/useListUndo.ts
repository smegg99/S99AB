// web/src/composables/primitives/useListUndo.ts
import { nextTick, watch, type WatchSource } from 'vue'
import { listUndo } from '../../browser/edit'

/**
 * Ctrl+Z and Ctrl+Shift+Z around a pane's lists: the editor's undo or redo once `after` settles.
 * Vuetify keeps a focused list's text, so the list is blurred and refocused after the step lands.
 */
export function useListUndo(after: () => Promise<unknown>, changed: WatchSource) {
  let held: HTMLElement | null = null
  watch(changed, async () => {
    const list = held
    held = null
    if (!list || document.activeElement !== list || list.getAttribute('aria-expanded') === 'true') return
    list.blur()
    await nextTick()
    list.focus({ preventScroll: true })
  }, { flush: 'post' })
  return (event: KeyboardEvent) => {
    const list = event.target as HTMLElement
    listUndo(event, async () => {
      try {
        await after()
      }
      finally {
        // What the saves before it changed is drawn first, so only the step's change refreshes the list.
        await nextTick()
        held = list
      }
    })
  }
}

/** A pane's pending saves for useListUndo's `after`: `track` each, `settled` once all earlier ones landed. */
export function pendingSaves() {
  let saving: Promise<unknown> = Promise.resolve()
  return {
    track<T>(run: Promise<T>): Promise<T> {
      saving = Promise.allSettled([saving, run])
      return run
    },
    settled: (): Promise<unknown> => saving,
  }
}
