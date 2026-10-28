// web/src/composables/primitives/internal/listUndo.ts

/** A pane's pending saves for useListUndo's `after`: `track` each, `settled` once all earlier ones landed. */
export function createPendingSaves() {
  let saving: Promise<unknown> = Promise.resolve()
  return {
    track<T>(run: Promise<T>): Promise<T> {
      saving = Promise.allSettled([saving, run])
      return run
    },
    settled: (): Promise<unknown> => saving,
  }
}
