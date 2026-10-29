// web/tests/theme-transition.spec.ts

import { readFileSync } from 'node:fs'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { configureMotion, resetMotion } from '../src/composables/motion/internal/motion'
import { configureThemeTransition, durationFor, resetThemeTransition, resolvedTransition, THEME_TRANSITIONS } from '../src/composables/appearance/internal/themeTransition'
import { COVER_SHAPES, coverRadius, originOf, runThemeTransition } from '../src/composables/appearance/internal/cover'

/** Stands in for the browser's entry point and records what it was given. */
function fakeViewTransitions() {
  const calls: Array<() => void> = []
  let settle: () => void = () => {}

  const finished = new Promise<void>((resolve) => {
    settle = resolve
  })

  const start = vi.fn((callback: () => void) => {
    calls.push(callback)
    // The browser runs it synchronously; the second snapshot shows its result.
    callback()
    return { finished }
  })

  Object.defineProperty(document, 'startViewTransition', {
    value: start, configurable: true, writable: true,
  })
  return { start, calls, settle }
}

function withoutViewTransitions() {
  Object.defineProperty(document, 'startViewTransition', {
    value: undefined, configurable: true, writable: true,
  })
}

beforeEach(() => {
  resetThemeTransition()
  resetMotion()
  localStorage.clear()
  delete document.documentElement.dataset.s99abVt
  // Removed on an animation frame no test waits for, so it is cleared here.
  delete document.documentElement.dataset.s99abVtInstant
  document.documentElement.style.removeProperty('--s99ab-vt-easing')
})

afterEach(() => {
  withoutViewTransitions()
  resetMotion()
})

describe('runThemeTransition', () => {
  // The theme changes whatever the browser supports, including Firefox without view transitions.
  it('applies the change where the browser has no view transitions', () => {
    withoutViewTransitions()
    const apply = vi.fn()

    runThemeTransition(apply)

    expect(apply).toHaveBeenCalledOnce()
    expect(document.documentElement.dataset.s99abVt).toBeUndefined()
  })

  it('applies the change through the browser when it can', () => {
    const { start } = fakeViewTransitions()
    const apply = vi.fn()

    runThemeTransition(apply, { x: 10, y: 20 }, 'circle')

    expect(start).toHaveBeenCalledOnce()
    expect(apply).toHaveBeenCalledOnce()
    expect(document.documentElement.dataset.s99abVt).toBe('circle')
  })

  // `circle(farthest-corner)` is invalid and a keyword radius cannot interpolate
  // from 0, so the end radius is a length.
  it('measures the radius the circle has to reach', () => {
    fakeViewTransitions()

    runThemeTransition(() => {}, { x: 0, y: 0 })

    const radius = document.documentElement.style.getPropertyValue('--s99ab-vt-r')
    expect(radius).toMatch(/^\d+(\.\d+)?px$/)
    expect(Number.parseFloat(radius)).toBeGreaterThan(0)
  })

  // The origin lets one keyframe work from any button.
  it('puts the origin where the stylesheet reads it', () => {
    fakeViewTransitions()

    runThemeTransition(() => {}, { x: 42, y: 99 })

    const style = document.documentElement.style
    expect(style.getPropertyValue('--s99ab-vt-x')).toBe('42px')
    expect(style.getPropertyValue('--s99ab-vt-y')).toBe('99px')
  })

  // A leftover attribute would animate the next unanimated change.
  it('clears the attribute when the transition ends', async () => {
    const { settle } = fakeViewTransitions()

    runThemeTransition(() => {}, undefined, 'circle')
    expect(document.documentElement.dataset.s99abVt).toBe('circle')

    settle()
    await Promise.resolve()
    await Promise.resolve()

    expect(document.documentElement.dataset.s99abVt).toBeUndefined()
  })

  // A hidden tab rejects with InvalidStateError; the attribute still comes off
  // and the rejection is not logged.
  it('clears the attribute when the browser refuses the transition', async () => {
    const refused = Promise.reject(new DOMException('skipped', 'InvalidStateError'))
    Object.defineProperty(document, 'startViewTransition', {
      value: (callback: () => void) => {
        callback()
        return { finished: refused }
      },
      configurable: true,
      writable: true,
    })

    const apply = vi.fn()
    runThemeTransition(apply)

    expect(apply).toHaveBeenCalledOnce()
    await refused.catch(() => {})
    await Promise.resolve()

    expect(document.documentElement.dataset.s99abVt).toBeUndefined()
  })

  // A preview shows one shape without changing the stored setting.
  it('takes a one-off shape without disturbing what is remembered', () => {
    fakeViewTransitions()
    configureThemeTransition({ transition: 'circle' })

    runThemeTransition(() => {}, undefined, 'sweep')

    expect(document.documentElement.dataset.s99abVt).toBe('sweep')
    expect(resolvedTransition()).toBe('circle')
  })

  // Vuetify components carry their own background-color transition, so `none`
  // suppresses page transitions while applying.
  it('suppresses every transition on the page while applying none', () => {
    const { start } = fakeViewTransitions()
    configureThemeTransition({ transition: 'none' })

    let suppressedDuringApply: string | undefined
    const apply = vi.fn(() => {
      suppressedDuringApply = document.documentElement.dataset.s99abVtInstant
    })

    runThemeTransition(apply)

    expect(apply).toHaveBeenCalledOnce()
    expect(start).not.toHaveBeenCalled()
    expect(suppressedDuringApply).toBe('')
  })

  // Motion off disables the theme transition too.
  it('honours motion off', () => {
    const { start } = fakeViewTransitions()
    configureMotion({ level: 'off' })
    const apply = vi.fn()

    runThemeTransition(apply)

    expect(apply).toHaveBeenCalledOnce()
    expect(start).not.toHaveBeenCalled()
  })

  // Reduced motion turns every shape into a fade, which has no movement.
  it('softens every shape to a fade at reduced motion', () => {
    fakeViewTransitions()
    configureMotion({ level: 'reduced' })
    configureThemeTransition({ transition: 'circle' })

    runThemeTransition(() => {})

    expect(document.documentElement.dataset.s99abVt).toBe('fade')
  })
})

// Every offered shape has a stylesheet rule, and every rule has a shape.
describe('the shapes on offer', () => {
  it('has a rule in the stylesheet for every shape it offers', () => {
    // A plain path: happy-dom rewrites import.meta.url to a non-file scheme. vitest runs from the project root.
    const sheet = readFileSync('src/styles/_theme-transition.scss', 'utf8')

    for (const shape of THEME_TRANSITIONS) {
      // `none` never starts a transition, so it has no rule.
      if (shape === 'none') continue

      // Cover shapes are not View Transitions; they overlay an element dressed by two classes.
      if (COVER_SHAPES.has(shape)) {
        expect(sheet, 'no rule dresses the cover sheet').toContain('.s99ab-vt-cover')
        continue
      }

      expect(sheet, `no rule selects ${shape}`)
        .toContain(`data-s99ab-vt='${shape}'`)
    }
  })

  // Without a fill-mode the clip-path reverts when the animation ends and the
  // snapshot flashes full screen on `circle-in`. The shorthand resets fill-mode, so it is banned.
  it('holds the last frame, and uses no shorthand that would reset that', () => {
    const sheet = readFileSync('src/styles/_theme-transition.scss', 'utf8')

    expect(sheet).toContain('animation-fill-mode: both')
    expect(sheet, 'the animation shorthand resets fill-mode')
      .not.toMatch(/animation:\s/)
  })

  it('names every one of them on the root, so a rule can select it', () => {
    fakeViewTransitions()

    for (const shape of THEME_TRANSITIONS) {
      if (shape === 'none') continue

      delete document.documentElement.dataset.s99abVt
      runThemeTransition(() => {}, { x: 1, y: 1 }, shape)
      expect(document.documentElement.dataset.s99abVt).toBe(shape)
    }
  })
})

describe('coverRadius', () => {
  // The far corner is the farther half on each axis, so it covers an origin at the edge.
  it('reaches the far corner from a corner origin', () => {
    Object.defineProperty(window, 'innerWidth', { value: 300, configurable: true })
    Object.defineProperty(window, 'innerHeight', { value: 400, configurable: true })

    expect(coverRadius({ x: 0, y: 0 })).toBeCloseTo(500)
    expect(coverRadius({ x: 300, y: 400 })).toBeCloseTo(500)
  })

  it('reaches every corner from the middle', () => {
    Object.defineProperty(window, 'innerWidth', { value: 300, configurable: true })
    Object.defineProperty(window, 'innerHeight', { value: 400, configurable: true })

    expect(coverRadius({ x: 150, y: 200 })).toBeCloseTo(250)
  })
})

describe('the knobs', () => {
  it('takes a shape\'s own duration over the shared one', () => {
    fakeViewTransitions()
    configureThemeTransition({ duration: 320, durations: { fade: 120 } })

    runThemeTransition(() => {}, undefined, 'fade')
    expect(document.documentElement.style.getPropertyValue('--s99ab-vt-duration')).toBe('120ms')

    runThemeTransition(() => {}, undefined, 'sweep')
    expect(document.documentElement.style.getPropertyValue('--s99ab-vt-duration')).toBe('320ms')
  })

  // Spreading a nested map replaces it, so setting one shape must keep the others.
  it('merges the maps rather than replacing them', () => {
    configureThemeTransition({ durations: { fade: 120, split: 200 } })
    configureThemeTransition({ durations: { fade: 90 } })

    expect(durationFor('fade')).toBe(90)
    expect(durationFor('split')).toBe(200)
  })

  // Unset, the stylesheet's knob applies; an inline value would always win.
  it('writes an easing only where the app set one', () => {
    fakeViewTransitions()

    runThemeTransition(() => {}, undefined, 'circle')
    expect(document.documentElement.style.getPropertyValue('--s99ab-vt-easing')).toBe('')

    configureThemeTransition({ easings: { circle: 'linear' } })
    runThemeTransition(() => {}, undefined, 'circle')
    expect(document.documentElement.style.getPropertyValue('--s99ab-vt-easing')).toBe('linear')
  })

  it('lets an app choose what reduced motion collapses to', () => {
    fakeViewTransitions()
    configureMotion({ level: 'reduced' })
    configureThemeTransition({ transition: 'circle', reducedFallback: 'none' })

    const apply = vi.fn()
    runThemeTransition(apply)

    expect(apply).toHaveBeenCalledOnce()
    expect(document.documentElement.dataset.s99abVt).toBeUndefined()
  })

  // For an app that wants its own colour transitions during the swap.
  it('leaves the page\'s own transitions alone when told to', () => {
    configureThemeTransition({ transition: 'none', suppressTransitions: false })

    let suppressed: string | undefined
    runThemeTransition(() => {
      suppressed = document.documentElement.dataset.s99abVtInstant
    })

    expect(suppressed).toBeUndefined()
  })
})

describe('the remembered choice', () => {
  it('falls back to the app default until the reader picks one', () => {
    configureThemeTransition({ transition: 'sweep' })
    expect(resolvedTransition()).toBe('sweep')
  })

  it('takes the reader over the app default', () => {
    configureThemeTransition({ transition: 'sweep' })
    localStorage.setItem('s99ab.theme.transition', 'fade')

    expect(resolvedTransition()).toBe('fade')
  })

  // A hand-edited or outdated stored value falls back to a valid shape.
  it('ignores a stored value that is not one of the shapes', () => {
    configureThemeTransition({ transition: 'circle' })
    localStorage.setItem('s99ab.theme.transition', 'explode')

    expect(resolvedTransition()).toBe('circle')
  })
})

describe('originOf', () => {
  it('takes the pointer where there is one', () => {
    expect(originOf({ clientX: 5, clientY: 6 } as unknown as Event)).toEqual({ x: 5, y: 6 })
  })

  it('is undefined without an event, so the caller centres it', () => {
    expect(originOf()).toBeUndefined()
  })

  // A keyboard click reports 0,0, so the shape opens from the button itself.
  it('uses the button itself when the keyboard fired the click', () => {
    const event = {
      clientX: 0,
      clientY: 0,
      currentTarget: {
        getBoundingClientRect: () => ({ left: 100, top: 50, width: 40, height: 40 }),
      },
    } as unknown as Event

    expect(originOf(event)).toEqual({ x: 120, y: 70 })
  })
})

// Vuetify draws the ripple with transitions, and the click that changes the
// appearance has just started one, so suppression must leave it running.
describe('the transitions the suppression must not touch', () => {
  it('excludes the ripple from the blanket rule', () => {
    const sheet = readFileSync('src/styles/_theme-transition.scss', 'utf8')
    const rule = sheet.slice(sheet.indexOf('[data-s99ab-vt-instant]'))
    const block = rule.slice(0, rule.indexOf('}') + 1)

    expect(block).toContain('transition: none !important')
    expect(block, 'the ripple is frozen mid-flight')
      .toContain(':not(.v-ripple__animation)')
  })

  // Every arm of the selector, pseudo-elements included.
  it('excludes it from the pseudo-element arms too', () => {
    const sheet = readFileSync('src/styles/_theme-transition.scss', 'utf8')

    for (const arm of ['::before', '::after']) {
      expect(sheet).toContain(`*:not(.v-ripple__animation)${arm}`)
    }
  })
})

// Cover shapes animate transform and opacity on one element instead of clip-path,
// which Chromium re-rasterises on the main thread every frame.
describe('the cover shapes', () => {
  interface FakeAnim {
    finished: Promise<void>
    settle: () => void
    frames: Keyframe[]
  }

  /** Element.animate, recorded. happy-dom does not implement it. */
  function fakeAnimate() {
    const runs: FakeAnim[] = []

    Object.defineProperty(HTMLElement.prototype, 'animate', {
      value(frames: Keyframe[]) {
        let settle = () => {}
        const finished = new Promise<void>((resolve) => {
          settle = () => resolve()
        })
        const run: FakeAnim = { finished, settle, frames }
        runs.push(run)
        return run
      },
      configurable: true,
      writable: true,
    })

    return runs
  }

  // A cover schedules its leave on a real timer after the hold, so pending
  // animations are drained before the stub is removed.
  afterEach(async () => {
    await new Promise(resolve => setTimeout(resolve, 200))
    Reflect.deleteProperty(HTMLElement.prototype, 'animate')
    for (const disc of document.querySelectorAll('.s99ab-vt-cover')) disc.remove()
  })

  it('takes no snapshot - it does not touch the View Transition API at all', () => {
    const runs = fakeAnimate()
    const { start } = fakeViewTransitions()

    runThemeTransition(() => {}, { x: 40, y: 40 }, 'cover')

    expect(start).not.toHaveBeenCalled()
    expect(runs).toHaveLength(1)
  })

  // The screen is one flat colour at the moment the theme changes.
  it('holds the change back until the disc has the screen', async () => {
    const runs = fakeAnimate()
    const apply = vi.fn()

    runThemeTransition(apply, { x: 40, y: 40 }, 'cover')

    expect(apply).not.toHaveBeenCalled()
    expect(document.querySelector('.s99ab-vt-cover')).not.toBeNull()

    runs[0]!.settle()
    await Promise.resolve()
    await Promise.resolve()

    expect(apply).toHaveBeenCalledOnce()
  })

  // Seeded small and scaled up, since a full-size disc needs an oversized
  // compositor texture. The end scale is never 1.
  it('scales rather than clipping, and is seeded small enough to be one tile', () => {
    const runs = fakeAnimate()

    runThemeTransition(() => {}, { x: 40, y: 40 }, 'cover')

    const [from, to] = runs[0]!.frames
    expect(from).toEqual({ transform: 'scale(0)' })
    expect(String(to!.transform)).toMatch(/^scale\(\d+(\.\d+)?\)$/)
    expect(Number.parseFloat(String(to!.transform).slice(6))).toBeGreaterThan(1)
  })

  // Exactly the viewport: one compositor tile.
  it('gives the sheet shapes the viewport and no transform at all', () => {
    const runs = fakeAnimate()

    runThemeTransition(() => {}, { x: 40, y: 40 }, 'veil')

    expect(runs[0]!.frames).toEqual([{ opacity: 0 }, { opacity: 1 }])
    expect(document.querySelector('.s99ab-vt-cover--sheet')).not.toBeNull()
  })

  it('carries a wipe on out the way it came, rather than reversing', () => {
    const runs = fakeAnimate()

    runThemeTransition(() => {}, { x: 40, y: 40 }, 'wipe')

    expect(runs[0]!.frames).toEqual([
      { transform: 'translateY(-100%)' },
      { transform: 'translateY(0)' },
    ])
  })

  it('fades the disc off, and closes it onto the point for `cover-in`', async () => {
    vi.useFakeTimers()
    const runs = fakeAnimate()

    runThemeTransition(() => {}, { x: 40, y: 40 }, 'cover-in')
    runs[0]!.settle()
    await vi.advanceTimersByTimeAsync(400)

    const [from, to] = runs[1]!.frames
    expect(Number.parseFloat(String(from!.transform).slice(6))).toBeGreaterThan(1)
    expect(to).toEqual({ transform: 'scale(0)' })
    vi.useRealTimers()
  })

  // The change is applied at the start of the hold, while the screen is fully covered.
  it('holds at full cover, with the change already applied', async () => {
    vi.useFakeTimers()
    const runs = fakeAnimate()
    const apply = vi.fn()

    runThemeTransition(apply, { x: 40, y: 40 }, 'cover')
    runs[0]!.settle()
    await vi.advanceTimersByTimeAsync(0)

    // Covered, changed, and not yet leaving.
    expect(apply).toHaveBeenCalledOnce()
    expect(runs).toHaveLength(1)

    await vi.advanceTimersByTimeAsync(200)
    expect(runs).toHaveLength(2)
    vi.useRealTimers()
  })

  // The cover's time is split between arriving, holding and leaving.
  it('gives the gesture its own duration, since its time is split three ways', () => {
    expect(durationFor('cover')).toBeGreaterThan(durationFor('fade'))
    expect(durationFor('cover-in')).toBeGreaterThan(durationFor('fade'))
  })

  it('clears the disc and applies the change even when the animation is refused', async () => {
    const apply = vi.fn()
    Object.defineProperty(HTMLElement.prototype, 'animate', {
      value: () => ({ finished: Promise.reject(new Error('refused')) }),
      configurable: true,
      writable: true,
    })

    runThemeTransition(apply, { x: 40, y: 40 }, 'cover')
    await Promise.resolve()
    await Promise.resolve()
    await Promise.resolve()

    expect(apply).toHaveBeenCalledOnce()
    expect(document.querySelector('.s99ab-vt-cover')).toBeNull()
  })

  // Without Element.animate it falls through to the paths that do not need it.
  it('falls back where the browser cannot animate an element', () => {
    const apply = vi.fn()
    const { start } = fakeViewTransitions()

    runThemeTransition(apply, { x: 40, y: 40 }, 'cover')

    expect(start).toHaveBeenCalledOnce()
    expect(apply).toHaveBeenCalledOnce()
  })
})

// Vuetify transitions `color` and `background-color` on every component, so a
// theme change starts one per element; these are suppressed during the swap.
describe('the page\'s own colour transitions', () => {
  afterEach(() => {
    Reflect.deleteProperty(HTMLElement.prototype, 'animate')
    delete document.documentElement.dataset.s99abVtInstant
    for (const disc of document.querySelectorAll('.s99ab-vt-cover')) disc.remove()
  })

  /** Element.animate that settles as soon as it is asked to. */
  function instantAnimate() {
    Object.defineProperty(HTMLElement.prototype, 'animate', {
      value: () => ({ finished: Promise.resolve() }),
      configurable: true,
      writable: true,
    })
  }

  it('applies the change with them suppressed, under a cover', async () => {
    instantAnimate()
    let suppressed: string | undefined

    runThemeTransition(() => {
      suppressed = document.documentElement.dataset.s99abVtInstant
    }, { x: 10, y: 10 }, 'cover')

    await Promise.resolve()
    await Promise.resolve()

    expect(suppressed, 'the page was left interpolating its own colours').toBe('')
  })

  it('does the same inside a View Transition, whose snapshot is taken after', () => {
    fakeViewTransitions()
    let suppressed: string | undefined

    runThemeTransition(() => {
      suppressed = document.documentElement.dataset.s99abVtInstant
    }, { x: 10, y: 10 }, 'circle')

    expect(suppressed).toBe('')
  })

  // An app can keep its own colour transitions.
  it('leaves them alone for an app that turned the suppression off', () => {
    configureThemeTransition({ suppressTransitions: false })
    fakeViewTransitions()
    let suppressed: string | undefined

    runThemeTransition(() => {
      suppressed = document.documentElement.dataset.s99abVtInstant
    }, { x: 10, y: 10 }, 'circle')

    expect(suppressed).toBeUndefined()
  })
})

// The appearance toggles do not ripple, since a full-screen animation follows.
describe('the appearance toggles', () => {
  it.each(['ThemeToggle', 'ContrastToggle'])('%s turns its ripple off', (name) => {
    const source = readFileSync(`src/components/shell/${name}.vue`, 'utf8')
    expect(source).toContain(':ripple="false"')
  })
})

// A shape crossing the whole window needs longer than a control's timing to be followed.
describe('how long a shape is given', () => {
  it('gives every one of them longer than a control\'s own motion', () => {
    for (const shape of THEME_TRANSITIONS) {
      if (shape === 'none') continue
      expect(durationFor(shape), `${shape} is quicker than a hover`).toBeGreaterThanOrEqual(440)
    }
  })

  // Shapes crossing the full width, and the one that travels back out, get the most time.
  it('gives the ones that travel furthest the most time', () => {
    expect(durationFor('wipe-start')).toBeGreaterThan(durationFor('wipe'))
    expect(durationFor('cover-in')).toBeGreaterThan(durationFor('cover'))
    expect(durationFor('veil')).toBeLessThan(durationFor('cover'))
  })
})
