// web/tests/toast.spec.ts

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { configureToast } from '../src/composables/toast/internal/config'
import { queueDepth, resetToasts, visibleAt } from '../src/composables/toast/internal/queue'
import { useToast } from '../src/composables/toast/useToast'

// Module-level state lets anything raise a toast; each test resets it.
beforeEach(() => {
  resetToasts()
  configureToast({
    position: 'bottom-end',
    timeout: { success: 3000, info: 4000, warning: 6000, error: 0 },
    maxVisible: 3,
    dedupeWindow: 1000,
  })
  vi.useFakeTimers()
})

afterEach(() => {
  vi.useRealTimers()
})

describe('dedupe', () => {
  it('counts a repeat instead of stacking it', () => {
    const { error } = useToast()
    for (let i = 0; i < 5; i++) error('Save failed')

    const shown = visibleAt('bottom-end')
    expect(shown).toHaveLength(1)
    expect(shown[0]!.count).toBe(5)
  })

  it('returns the same id for every repeat', () => {
    const { error } = useToast()
    expect(error('Save failed')).toBe(error('Save failed'))
  })

  it('treats a repeat past the window as a new toast', () => {
    const { error } = useToast()
    error('Save failed')
    vi.advanceTimersByTime(1500)
    error('Save failed')

    expect(visibleAt('bottom-end')).toHaveLength(2)
  })

  it('does not merge different kinds with the same text', () => {
    const { error, warning } = useToast()
    error('Same words')
    warning('Same words')

    expect(visibleAt('bottom-end')).toHaveLength(2)
  })

  it('stacks when dedupe is off', () => {
    const { error } = useToast()
    for (let i = 0; i < 3; i++) error('Save failed', { dedupe: false })

    expect(visibleAt('bottom-end')).toHaveLength(3)
  })
})

describe('timeouts', () => {
  it('clears a timed toast when its timeout elapses', () => {
    useToast().success('Saved')
    expect(visibleAt('bottom-end')).toHaveLength(1)

    vi.advanceTimersByTime(3000)
    expect(visibleAt('bottom-end')).toHaveLength(0)
  })

  // Errors stay until dismissed.
  it('leaves an error until it is dismissed', () => {
    useToast().error('Save failed')

    vi.advanceTimersByTime(60_000)
    expect(visibleAt('bottom-end')).toHaveLength(1)
  })

  it('pauses and resumes the countdown', () => {
    const { success, pause, resume } = useToast()
    const id = success('Saved')

    vi.advanceTimersByTime(2000)
    pause(id)
    vi.advanceTimersByTime(60_000)
    expect(visibleAt('bottom-end')).toHaveLength(1)

    // Resume restarts the countdown from the full timeout.
    resume(id)
    vi.advanceTimersByTime(2999)
    expect(visibleAt('bottom-end')).toHaveLength(1)
    vi.advanceTimersByTime(1)
    expect(visibleAt('bottom-end')).toHaveLength(0)
  })

  /*
   * Resume restarts the countdown, so the revision changes and the bar element
   * is rebuilt instead of continuing its paused animation.
   */
  it('marks a resumed toast as having a new countdown', () => {
    const { success, pause, resume } = useToast()
    const id = success('Saved')
    const before = visibleAt('bottom-end')[0]!.revision

    vi.advanceTimersByTime(2000)
    pause(id)
    resume(id)

    expect(visibleAt('bottom-end')[0]!.revision).toBe(before + 1)
  })

  it('restarts the countdown when a repeat is counted', () => {
    const { info } = useToast()
    info('Syncing')

    vi.advanceTimersByTime(3000)
    info('Syncing') // inside the 4000ms timeout, bumps the count
    vi.advanceTimersByTime(3000)

    expect(visibleAt('bottom-end')).toHaveLength(1)
  })
})

describe('overflow', () => {
  it('shows only maxVisible and queues the rest', () => {
    const { info } = useToast()
    for (let i = 1; i <= 8; i++) info(`Message ${i}`)

    expect(visibleAt('bottom-end')).toHaveLength(3)
    expect(queueDepth('bottom-end')).toBe(5)
  })

  // Toasts raised together leave oldest first, one stagger apart.
  it('lets a batch that expires together leave one at a time', () => {
    const { info } = useToast()
    for (let i = 1; i <= 5; i++) info(`Message ${i}`, { timeout: 1000 })

    vi.advanceTimersByTime(1000)
    expect(visibleAt('bottom-end').map(t => t.text)).toEqual(['Message 2', 'Message 3', 'Message 4'])

    vi.advanceTimersByTime(220)
    expect(visibleAt('bottom-end').map(t => t.text)).toEqual(['Message 3', 'Message 4', 'Message 5'])

    vi.advanceTimersByTime(220)
    expect(visibleAt('bottom-end').map(t => t.text)).toEqual(['Message 4', 'Message 5'])
  })

  // The stagger stretches the countdown, so the bar always ends when the toast leaves.
  it('stretches the countdown rather than delaying the dismissal', () => {
    const { info } = useToast()
    for (let i = 1; i <= 3; i++) info(`Message ${i}`, { timeout: 1000 })

    expect(visibleAt('bottom-end').map(t => t.runFor)).toEqual([1000, 1220, 1440])
  })

  // A queued toast's life starts when it becomes visible, so a burst does not expire unseen.
  it('does not start a queued toast countdown until it is visible', () => {
    const { info } = useToast()
    for (let i = 1; i <= 5; i++) info(`Message ${i}`, { timeout: 1000 })

    vi.advanceTimersByTime(1000)
    expect(visibleAt('bottom-end').map(t => t.text)).toContain('Message 4')

    vi.advanceTimersByTime(999)
    expect(visibleAt('bottom-end').map(t => t.text)).toContain('Message 4')
    vi.advanceTimersByTime(1)
    expect(visibleAt('bottom-end').map(t => t.text)).not.toContain('Message 4')
  })

  // The stagger applies to expiry only; a click dismisses at once.
  it('never makes a dismiss by hand wait its turn', () => {
    const { info, dismiss } = useToast()
    for (let i = 1; i <= 3; i++) info(`Message ${i}`, { timeout: 1000 })

    vi.advanceTimersByTime(1000)
    const remaining = visibleAt('bottom-end')
    dismiss(remaining[0]!.id)
    dismiss(remaining[1]!.id)

    expect(visibleAt('bottom-end')).toHaveLength(0)
  })

  it('drops nothing on overflow', () => {
    const { info } = useToast()
    for (let i = 1; i <= 5; i++) info(`Message ${i}`, { timeout: 1000 })

    const seen: string[] = []
    for (let round = 0; round < 3; round++) {
      seen.push(...visibleAt('bottom-end').map(t => t.text))
      vi.advanceTimersByTime(1000)
    }
    expect(new Set(seen).size).toBe(5)
  })
})

describe('positions', () => {
  it('keeps a queue per position', () => {
    const { info } = useToast()
    info('a', { position: 'top' })
    info('b', { position: 'top' })
    info('c', { position: 'bottom-start' })

    expect(visibleAt('top')).toHaveLength(2)
    expect(visibleAt('bottom-start')).toHaveLength(1)
    expect(visibleAt('bottom-end')).toHaveLength(0)
  })

  // One position filling up does not delay another.
  it('does not let one position fill another', () => {
    const { info } = useToast()
    for (let i = 0; i < 8; i++) info(`top ${i}`, { position: 'top' })
    info('elsewhere', { position: 'bottom-end' })

    expect(visibleAt('bottom-end')).toHaveLength(1)
    expect(queueDepth('bottom-end')).toBe(0)
  })

  it('deduping is per position', () => {
    const { error } = useToast()
    error('Save failed', { position: 'top' })
    error('Save failed', { position: 'bottom-end' })

    expect(visibleAt('top')).toHaveLength(1)
    expect(visibleAt('bottom-end')).toHaveLength(1)
  })
})

describe('dismiss and clear', () => {
  it('dismisses by id and promotes the next queued toast', () => {
    const { info, dismiss } = useToast()
    const ids = [1, 2, 3, 4].map(i => info(`Message ${i}`))

    dismiss(ids[0]!)
    expect(visibleAt('bottom-end').map(t => t.text))
      .toEqual(['Message 2', 'Message 3', 'Message 4'])
  })

  it('clears one position without touching another', () => {
    const { info, clear } = useToast()
    info('a', { position: 'top' })
    info('b', { position: 'bottom-end' })

    clear('top')
    expect(visibleAt('top')).toHaveLength(0)
    expect(visibleAt('bottom-end')).toHaveLength(1)
  })

  it('clears everything', () => {
    const { info, clear } = useToast()
    info('a', { position: 'top' })
    info('b', { position: 'bottom-end' })

    clear()
    expect(visibleAt('top')).toHaveLength(0)
    expect(visibleAt('bottom-end')).toHaveLength(0)
  })

  // A cleared toast's timer is cancelled with it.
  it('does not resurrect a cleared toast when its timer fires', () => {
    const { success, clear } = useToast()
    success('Saved')
    clear()

    vi.advanceTimersByTime(10_000)
    expect(visibleAt('bottom-end')).toHaveLength(0)
  })
})

describe('config', () => {
  it('honours an overridden default position', () => {
    configureToast({ position: 'top-start' })
    useToast().info('a')

    expect(visibleAt('top-start')).toHaveLength(1)
  })

  it('honours an overridden maxVisible', () => {
    configureToast({ maxVisible: 1 })
    const { info } = useToast()
    info('a')
    info('b')

    expect(visibleAt('bottom-end')).toHaveLength(1)
    expect(queueDepth('bottom-end')).toBe(1)
  })

  it('merges a partial timeout map rather than replacing it', () => {
    configureToast({ timeout: { success: 500 } })
    const { success, info } = useToast()
    success('a')
    info('b', { position: 'top' })

    vi.advanceTimersByTime(500)
    expect(visibleAt('bottom-end')).toHaveLength(0)
    expect(visibleAt('top')).toHaveLength(1) // info kept its own 4000ms
  })
})

describe('actions', () => {
  it('carries an action through to the toast', () => {
    const onClick = vi.fn()
    useToast().warning('Archived', { timeout: 0, action: { label: 'Undo', onClick } })

    const toast = visibleAt('bottom-end')[0]!
    expect(toast.action?.label).toBe('Undo')

    toast.action!.onClick()
    expect(onClick).toHaveBeenCalledOnce()
  })
})

describe('changing a toast that is already on screen', () => {
  // Updated in place, keeping its id and position in the stack.
  it('changes it in place and restarts the countdown', () => {
    const { info, update } = useToast()
    const id = info('Working', { timeout: 0 })

    vi.advanceTimersByTime(10_000)
    expect(update(id, { kind: 'success', text: 'Done', timeout: 1000 })).toBe(true)

    const shown = visibleAt('bottom-end')[0]!
    expect(shown.id).toBe(id)
    expect(shown.kind).toBe('success')
    expect(shown.text).toBe('Done')

    // It now has a lifespan, counted from the change.
    vi.advanceTimersByTime(999)
    expect(visibleAt('bottom-end')).toHaveLength(1)
    vi.advanceTimersByTime(1)
    expect(visibleAt('bottom-end')).toHaveLength(0)
  })

  // The bar is keyed on the revision, so it restarts with the timer.
  it('marks the toast as having a new countdown', () => {
    const { info, update } = useToast()
    const id = info('Working', { timeout: 0 })
    const before = visibleAt('bottom-end')[0]!.revision

    update(id, { text: 'Still working' })
    expect(visibleAt('bottom-end')[0]!.revision).toBe(before + 1)
  })

  // Dismissed while the work ran; the caller decides what that means.
  it('says so when there is no such toast', () => {
    expect(useToast().update(4321, { text: 'anyone?' })).toBe(false)
  })
})

describe('a toast for a promise', () => {
  // Work that beats appearAfter shows no pending toast.
  it('shows no pending toast for work that finishes first', async () => {
    await useToast().promise(Promise.resolve('ok'), {
      pending: 'Saving',
      success: 'Saved',
    })

    expect(visibleAt('bottom-end').map(t => t.text)).toEqual(['Saved'])
  })

  it('turns the pending toast into the outcome, in place', async () => {
    let finish!: (value: string) => void
    const work = new Promise<string>((resolve) => {
      finish = resolve
    })

    const done = useToast().promise(work, { pending: 'Saving', success: 'Saved' })

    await vi.advanceTimersByTimeAsync(220)
    const pending = visibleAt('bottom-end')[0]!
    expect(pending.text).toBe('Saving')
    expect(pending.spin).toBe(true)
    expect(pending.timeout).toBe(0)

    finish('ok')
    await vi.advanceTimersByTimeAsync(450)
    await done

    const outcome = visibleAt('bottom-end')[0]!
    expect(outcome.id).toBe(pending.id)
    expect(outcome.kind).toBe('success')
    expect(outcome.text).toBe('Saved')
    expect(outcome.spin).toBe(false)
    expect(outcome.timeout).toBe(3000)
  })

  // Held for holdFor, so work crossing appearAfter does not flash a spinner.
  it('holds a pending toast long enough to be read', async () => {
    let finish!: (value: string) => void
    const work = new Promise<string>((resolve) => {
      finish = resolve
    })

    const done = useToast().promise(work, { pending: 'Saving', success: 'Saved' })
    await vi.advanceTimersByTimeAsync(220)
    finish('ok')

    await vi.advanceTimersByTimeAsync(449)
    expect(visibleAt('bottom-end')[0]!.text).toBe('Saving')

    await vi.advanceTimersByTimeAsync(1)
    await done
    expect(visibleAt('bottom-end')[0]!.text).toBe('Saved')
  })

  // The rejection is reported and still rethrown.
  it('reports a rejection and rethrows it', async () => {
    const { promise } = useToast()

    await expect(
      promise(Promise.reject(new Error('nope')), { error: err => `Failed: ${(err as Error).message}` }),
    ).rejects.toThrow('nope')

    const shown = visibleAt('bottom-end')[0]!
    expect(shown.kind).toBe('error')
    expect(shown.text).toBe('Failed: nope')
  })

  // With no message for the outcome, the pending toast is cleared and nothing replaces it.
  it('clears the pending toast when the outcome has no message', async () => {
    let finish!: (value: string) => void
    const work = new Promise<string>((resolve) => {
      finish = resolve
    })

    const done = useToast().promise(work, { pending: 'Saving' })
    await vi.advanceTimersByTimeAsync(220)
    expect(visibleAt('bottom-end')).toHaveLength(1)

    finish('ok')
    await vi.advanceTimersByTimeAsync(450)
    await done

    expect(visibleAt('bottom-end')).toHaveLength(0)
  })

  // The user dismissed it while the work ran; the outcome still shows.
  it('raises a fresh toast when the pending one was dismissed', async () => {
    let finish!: (value: string) => void
    const work = new Promise<string>((resolve) => {
      finish = resolve
    })

    const toast = useToast()
    const done = toast.promise(work, { pending: 'Saving', success: 'Saved' })
    await vi.advanceTimersByTimeAsync(220)
    toast.dismiss(visibleAt('bottom-end')[0]!.id)

    finish('ok')
    await vi.advanceTimersByTimeAsync(450)
    await done

    expect(visibleAt('bottom-end').map(t => t.text)).toEqual(['Saved'])
  })
})

describe('the glyph a kind wears', () => {
  it('comes from the config, and one entry can be replaced without the rest', () => {
    const { iconOf, success, error } = useToast()
    configureToast({ icons: { success: 'mdi-party-popper' } })

    try {
      success('Saved')
      error('Nope')
      const [saved, nope] = visibleAt('bottom-end')

      expect(iconOf(saved!)).toBe('mdi-party-popper')
      expect(iconOf(nope!)).toBe('mdi-alert-circle-outline')
    }
    finally {
      configureToast({ icons: { success: 'mdi-check-circle-outline' } })
    }
  })

  it('is still overridable per toast, and droppable', () => {
    const { iconOf, info } = useToast()
    info('custom', { icon: 'mdi-rocket' })
    info('none', { icon: false, dedupe: false })

    const [custom, none] = visibleAt('bottom-end')
    expect(iconOf(custom!)).toBe('mdi-rocket')
    expect(iconOf(none!)).toBe(null)
  })
})

// The queues are module state, so on a server toasts must not leak between requests.
describe('on a server', () => {
  it('raises nothing at all', () => {
    vi.stubGlobal('window', undefined)
    try {
      expect(useToast().info('into the void')).toBe(0)
      expect(visibleAt('bottom-end')).toHaveLength(0)
    }
    finally {
      vi.unstubAllGlobals()
    }
  })
})
