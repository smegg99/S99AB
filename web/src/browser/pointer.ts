// web/src/browser/pointer.ts
export interface PointerTrack {
  move: (event: PointerEvent) => void
  /** The press ended: `released` for the pointer's own pointerup, false for a cancel, a blur, a key or the teardown. */
  end: (released: boolean, event?: PointerEvent) => void
  /** A key while pressed, in the capture phase; true ends the press. */
  key?: (event: KeyboardEvent) => boolean
}

/**
 * Tracks a press on the window, because WebKitGTK can lose element pointer capture. A move with no
 * button held means the release happened outside the window, so it ends the press. Returns the teardown.
 */
export function trackPointer(start: PointerEvent, handlers: PointerTrack): () => void {
  const win = (start.currentTarget as Element | null)?.ownerDocument?.defaultView ?? window
  let active = true
  function stop(released = false, event?: PointerEvent) {
    if (!active) return
    active = false
    win.removeEventListener('pointermove', move)
    win.removeEventListener('pointerup', release)
    win.removeEventListener('pointercancel', cancel)
    win.removeEventListener('blur', cancel)
    win.removeEventListener('keydown', key, true)
    handlers.end(released, event)
  }
  function matches(event: PointerEvent) {
    return start.pointerId === undefined || event.pointerId === start.pointerId
  }
  function release(event: PointerEvent) {
    if (matches(event)) stop(true, event)
  }
  function cancel() {
    stop()
  }
  function move(event: PointerEvent) {
    if (!matches(event)) return
    if (event.buttons === 0) stop()
    else handlers.move(event)
  }
  function key(event: KeyboardEvent) {
    if (handlers.key?.(event)) stop()
  }
  win.addEventListener('pointermove', move)
  win.addEventListener('pointerup', release)
  win.addEventListener('pointercancel', cancel)
  win.addEventListener('blur', cancel)
  win.addEventListener('keydown', key, true)
  return () => stop()
}
