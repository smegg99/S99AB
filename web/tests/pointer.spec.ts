// web/tests/pointer.spec.ts
import { afterEach, describe, expect, it, vi } from 'vitest'
import { trackPointer } from '../src/browser/pointer'

const event = (type: string, pointerId = 7, buttons = 1) => Object.assign(new Event(type), { pointerId, buttons })
afterEach(() => vi.unstubAllGlobals())

describe('pointer tracking', () => {
  function setup() {
    const win = new EventTarget()
    vi.stubGlobal('window', win)
    const move = vi.fn()
    const end = vi.fn()
    const stop = trackPointer(event('pointerdown') as PointerEvent, { move, end })
    return { win, move, end, stop }
  }

  it('tracks only the pressed pointer and removes all listeners when released', () => {
    const { win, move, end } = setup()
    win.dispatchEvent(event('pointermove', 9))
    win.dispatchEvent(event('pointerup', 9))
    expect(end).not.toHaveBeenCalled()
    win.dispatchEvent(event('pointermove'))
    expect(move).toHaveBeenCalledTimes(1)
    win.dispatchEvent(event('pointerup'))
    win.dispatchEvent(event('pointermove'))
    expect(move).toHaveBeenCalledTimes(1)
    expect(end).toHaveBeenCalledTimes(1)
  })

  it.each(['blur', 'pointercancel', 'lost-release', 'dispose'])('cleans up once on %s', (cause) => {
    const { win, move, end, stop } = setup()
    if (cause === 'dispose') stop()
    else if (cause === 'lost-release') win.dispatchEvent(event('pointermove', 7, 0))
    else win.dispatchEvent(event(cause))
    stop()
    win.dispatchEvent(event('pointermove'))
    expect(move).not.toHaveBeenCalled()
    expect(end).toHaveBeenCalledTimes(1)
  })
})
