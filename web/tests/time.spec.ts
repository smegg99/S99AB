// web/tests/time.spec.ts
import { effectScope } from 'vue'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { useNow } from '../src/composables/primitives/useNow'
import { clock, debounced, untilNextSecond } from '../src/browser/time'

const at = (h: number, m: number, s: number, ms = 0) => new Date(2026, 8, 25, h, m, s, ms)

describe('the clock\'s reading', () => {
  it('is 24-hour and padded', () => {
    expect(clock(at(8, 5, 9))).toBe('08:05:09')
    expect(clock(at(15, 4, 7))).toBe('15:04:07')
    expect(clock(at(0, 5, 9))).toBe('00:05:09')
  })

  // With tabular figures, the same number of characters is the same width.
  it('keeps one length through every hour of the day', () => {
    for (let h = 0; h < 24; h++) {
      expect(clock(at(h, 59, 59))).toHaveLength(8)
    }
  })
})

describe('the next second', () => {
  it('is counted from the millisecond now', () => {
    expect(untilNextSecond(at(10, 44, 58, 300))).toBe(700)
    expect(untilNextSecond(at(10, 44, 58, 999))).toBe(1)
    expect(untilNextSecond(at(10, 45, 0))).toBe(1000)
  })
})

describe('the current time', () => {
  const listeners = new Set<() => void>()
  const page = {
    hidden: false,
    addEventListener: (type: string, fn: () => void) => type === 'visibilitychange' && listeners.add(fn),
    removeEventListener: (type: string, fn: () => void) => type === 'visibilitychange' && listeners.delete(fn),
  }
  const show = (visible: boolean) => {
    page.hidden = !visible
    listeners.forEach(fn => fn())
  }
  const start = () => {
    const scope = effectScope()
    const now = scope.run(() => useNow())!
    return { scope, now }
  }

  beforeEach(() => {
    vi.useFakeTimers()
    vi.setSystemTime(at(10, 44, 58, 300))
    page.hidden = false
    listeners.clear()
    vi.stubGlobal('document', page)
  })

  afterEach(() => {
    vi.useRealTimers()
    vi.unstubAllGlobals()
  })

  it('turns over as each second begins, not a second after it was read', () => {
    const { scope, now } = start()
    vi.advanceTimersByTime(699)
    expect(clock(now.value)).toBe('10:44:58')
    vi.advanceTimersByTime(1)
    expect(clock(now.value)).toBe('10:44:59')
    vi.advanceTimersByTime(1000)
    expect(clock(now.value)).toBe('10:45:00')
    expect(vi.getTimerCount()).toBe(1)
    scope.stop()
  })

  // Timers use monotonic time; setSystemTime moves the wall clock under an armed timer, as sleep and clock changes do.
  it('is right within a second after the machine sleeps or its clock is set', () => {
    const { scope, now } = start()
    vi.setSystemTime(at(18, 30, 0, 300))
    vi.advanceTimersByTime(700)
    expect(clock(now.value)).toBe('18:30:01')
    scope.stop()
  })

  it('sleeps while the window is hidden and catches up when it shows', () => {
    const { scope, now } = start()
    show(false)
    expect(vi.getTimerCount()).toBe(0)
    vi.advanceTimersByTime(5000)
    expect(clock(now.value)).toBe('10:44:58')
    show(true)
    expect(clock(now.value)).toBe('10:45:03')
    expect(vi.getTimerCount()).toBe(1)
    // Shown mid-second, and still turning over as the next one begins.
    vi.advanceTimersByTime(699)
    expect(clock(now.value)).toBe('10:45:03')
    vi.advanceTimersByTime(1)
    expect(clock(now.value)).toBe('10:45:04')
    scope.stop()
  })

  it('waits for a window that opens hidden', () => {
    page.hidden = true
    const { scope, now } = start()
    expect(vi.getTimerCount()).toBe(0)
    vi.advanceTimersByTime(3000)
    show(true)
    expect(clock(now.value)).toBe('10:45:01')
    scope.stop()
  })

  it('shares one timer and listener until the last reader leaves', () => {
    const first = start()
    const second = start()
    expect(first.now).toBe(second.now)
    expect(vi.getTimerCount()).toBe(1)
    expect(listeners.size).toBe(1)
    first.scope.stop()
    expect(vi.getTimerCount()).toBe(1)
    vi.advanceTimersByTime(700)
    expect(clock(second.now.value)).toBe('10:44:59')
    second.scope.stop()
    expect(vi.getTimerCount()).toBe(0)
    expect(listeners.size).toBe(0)
  })

  it('leaves no timer or listener behind', () => {
    const { scope } = start()
    scope.stop()
    expect(vi.getTimerCount()).toBe(0)
    expect(listeners.size).toBe(0)
  })
})

describe('debounced', () => {
  beforeEach(() => vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout'] }))
  afterEach(() => vi.useRealTimers())

  it('runs once, with the last arguments, after the wait', async () => {
    const fn = vi.fn()
    const later = debounced(fn, 100)
    later.run('a')
    await vi.advanceTimersByTimeAsync(60)
    later.run('b')
    await vi.advanceTimersByTimeAsync(60)
    expect(fn).not.toHaveBeenCalled()
    await vi.advanceTimersByTimeAsync(40)
    expect(fn).toHaveBeenCalledExactlyOnceWith('b')
  })

  it('drops a pending call on cancel and reads the wait each time', async () => {
    const fn = vi.fn()
    let wait = 100
    const later = debounced(fn, () => wait)
    later.run()
    later.cancel()
    await vi.advanceTimersByTimeAsync(200)
    expect(fn).not.toHaveBeenCalled()
    wait = 10
    later.run()
    await vi.advanceTimersByTimeAsync(10)
    expect(fn).toHaveBeenCalledOnce()
  })
})
