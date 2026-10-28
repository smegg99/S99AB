// web/tests/delay.spec.ts

import { effectScope, ref } from 'vue'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { configureDelay, settle } from '../src/internal/delay'
import { useDelayed } from '../src/composables/useDelay'

// The composable registers an onScopeDispose, which warns outside one.
function inScope<T>(fn: () => T): T {
  const scope = effectScope()
  return scope.run(fn)!
}

describe('useDelayed', () => {
  beforeEach(() => {
    vi.useFakeTimers()
    configureDelay({ appearAfter: 200, holdFor: 400 })
  })
  afterEach(() => vi.useRealTimers())

  // A response faster than the threshold shows no skeleton.
  it('shows nothing at all for work that finishes before the threshold', async () => {
    const busy = ref(true)
    const shown = inScope(() => useDelayed(busy))

    await vi.advanceTimersByTimeAsync(150)
    busy.value = false
    await vi.advanceTimersByTimeAsync(1000)

    expect(shown.value).toBe(false)
  })

  it('shows once the work has run past the threshold', async () => {
    const busy = ref(true)
    const shown = inScope(() => useDelayed(busy))

    await vi.advanceTimersByTimeAsync(199)
    expect(shown.value).toBe(false)

    await vi.advanceTimersByTimeAsync(2)
    expect(shown.value).toBe(true)
  })

  // Once shown, it stays for the minimum hold.
  it('holds what it showed for the minimum, then clears', async () => {
    const busy = ref(true)
    const shown = inScope(() => useDelayed(busy))

    await vi.advanceTimersByTimeAsync(210)
    expect(shown.value).toBe(true)

    busy.value = false
    await vi.advanceTimersByTimeAsync(380)
    expect(shown.value).toBe(true)

    await vi.advanceTimersByTimeAsync(30)
    expect(shown.value).toBe(false)
  })

  // Work restarting during the hold keeps what is on screen.
  it('keeps what is on screen when the work starts again during the hold', async () => {
    const busy = ref(true)
    const shown = inScope(() => useDelayed(busy))

    await vi.advanceTimersByTimeAsync(210)
    busy.value = false
    await vi.advanceTimersByTimeAsync(100)
    busy.value = true
    await vi.advanceTimersByTimeAsync(500)

    expect(shown.value).toBe(true)
  })

  it('takes per-call thresholds over the configured ones', async () => {
    const busy = ref(true)
    const shown = inScope(() => useDelayed(busy, { appearAfter: 20 }))

    await vi.advanceTimersByTimeAsync(30)
    expect(shown.value).toBe(true)
  })

  it('starts false for work that was never busy', () => {
    expect(inScope(() => useDelayed(false)).value).toBe(false)
  })
})

describe('settle', () => {
  beforeEach(() => {
    vi.useFakeTimers()
    configureDelay({ appearAfter: 200, holdFor: 400 })
  })
  afterEach(() => vi.useRealTimers())

  it('holds a fast success open for the minimum', async () => {
    let done = false
    const work = settle(Promise.resolve('ok')).then((v) => {
      done = true
      return v
    })

    await vi.advanceTimersByTimeAsync(300)
    expect(done).toBe(false)

    await vi.advanceTimersByTimeAsync(150)
    expect(done).toBe(true)
    await expect(work).resolves.toBe('ok')
  })

  // A fast failure is held too, so it does not flash.
  it('holds a fast failure too', async () => {
    // Attach handlers at once, or the runner reports an unhandled rejection.
    const failing = Promise.reject(new Error('nope'))
    failing.catch(() => {})

    let settled = false
    const work = settle(failing)
    work.then(
      () => { settled = true },
      () => { settled = true },
    )

    await vi.advanceTimersByTimeAsync(300)
    expect(settled).toBe(false)

    await vi.advanceTimersByTimeAsync(150)
    expect(settled).toBe(true)
    await expect(work).rejects.toThrow('nope')
  })

  it('does not delay work that already took longer than the minimum', async () => {
    const slow = new Promise(resolve => setTimeout(() => resolve('late'), 900))
    const work = settle(slow)

    await vi.advanceTimersByTimeAsync(901)
    await expect(work).resolves.toBe('late')
  })
})
