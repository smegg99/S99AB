// web/src/browser/pointer.ts
export interface PointerTrack {
  move: (event: PointerEvent) => void
  end: () => void
}

/** Tracks a resize on the window because WebKitGTK can lose element pointer capture. */
export function trackPointer(start: PointerEvent, handlers: PointerTrack): () => void {
  const win = (start.currentTarget as Element | null)?.ownerDocument?.defaultView ?? window
  let active = true
  function stop() {
    if (!active) return
    active = false
    win.removeEventListener('pointermove', move)
    win.removeEventListener('pointerup', release)
    win.removeEventListener('pointercancel', release)
    win.removeEventListener('blur', stop)
    handlers.end()
  }
  function matches(event: PointerEvent) {
    return start.pointerId === undefined || event.pointerId === start.pointerId
  }
  function release(event: PointerEvent) {
    if (matches(event)) stop()
  }
  function move(event: PointerEvent) {
    if (!matches(event)) return
    if (event.buttons === 0) stop()
    else handlers.move(event)
  }
  win.addEventListener('pointermove', move)
  win.addEventListener('pointerup', release)
  win.addEventListener('pointercancel', release)
  win.addEventListener('blur', stop)
  return stop
}
