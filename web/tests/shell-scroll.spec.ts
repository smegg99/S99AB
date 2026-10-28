// web/tests/shell-scroll.spec.ts

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { quietScroll, scrollSettling, shellScrollBehavior } from '../src/composables/shell/internal/scroll'

// Covers the scroll rules in shellScrollBehavior.

const at = (path: string, hash = '') => ({ path, hash })

/** Records scroll calls, since happy-dom does not scroll. */
function region(scrollTop = 0) {
  const el = document.createElement('div')
  el.className = 'shell__main'

  const calls: Array<{ top: number, behavior: string }> = []
  Object.defineProperty(el, 'scrollTop', { value: scrollTop, writable: true })
  el.scrollTo = ((options: ScrollToOptions) => {
    calls.push({ top: options.top ?? 0, behavior: options.behavior ?? 'auto' })
    ;(el as unknown as { scrollTop: number }).scrollTop = options.top ?? 0
  }) as typeof el.scrollTo
  el.getBoundingClientRect = (() => ({ top: 0 })) as typeof el.getBoundingClientRect

  document.body.append(el)
  return { el, calls }
}

function panel(id: string, top: number) {
  const el = document.createElement('div')
  el.id = id
  el.getBoundingClientRect = (() => ({ top })) as typeof el.getBoundingClientRect
  document.body.append(el)
  return el
}

/** Long enough for the behaviour's own timers to run. */
const settle = () => new Promise(resolve => setTimeout(resolve, 120))

beforeEach(() => {
  document.body.innerHTML = ''
  delete document.documentElement.dataset.motion
})

afterEach(() => {
  vi.useRealTimers()
})

describe('no anchor means the top', () => {
  it('scrolls a new page to the top', async () => {
    const { el, calls } = region(2807)

    expect(shellScrollBehavior(at('/textures'), at('/theme'), null)).toBe(false)
    await settle()

    expect(el.scrollTop).toBe(0)
    expect(calls.every(call => call.behavior === 'instant')).toBe(true)
  })

  // Both routes are /theme, so the reset keys on the anchor and not on a path change.
  it('scrolls to the top when only the anchor is dropped', async () => {
    const { el } = region(2187)

    shellScrollBehavior(at('/theme'), at('/theme', '#spacing'), null)
    await settle()

    expect(el.scrollTop).toBe(0)
  })

  // Going to the top of the page on screen is a move within it, so it animates.
  it('animates the way up when the page is the one already open', async () => {
    const { calls } = region(300)

    shellScrollBehavior(at('/theme'), at('/theme', '#looks'), null)
    await settle()

    expect(calls.at(-1)).toEqual({ top: 0, behavior: 'smooth' })
  })

  // The top is not asserted again afterwards, since no new page is rendering.
  it('leaves an animation on the page alone once it has started', async () => {
    const { calls } = region(300)

    shellScrollBehavior(at('/theme'), at('/theme', '#looks'), null)
    await settle()

    expect(calls.filter(call => call.behavior === 'instant' && call.top === 0)).toEqual([])
  })

  it('still jumps when the page itself changed', async () => {
    const { calls } = region(2187)

    shellScrollBehavior(at('/textures'), at('/theme', '#spacing'), null)
    await settle()

    expect(calls.every(call => call.behavior === 'instant')).toBe(true)
  })

  it('does not animate for a reader who asked for less motion', async () => {
    document.documentElement.dataset.motion = 'reduced'
    const { calls } = region(300)

    shellScrollBehavior(at('/theme'), at('/theme', '#looks'), null)
    await settle()

    expect(calls.at(-1)?.behavior).toBe('instant')
  })

  // Going back restores the saved position.
  it('restores a saved position instead', async () => {
    const { el } = region(0)

    shellScrollBehavior(at('/theme'), at('/textures'), { top: 640 })
    await settle()

    expect(el.scrollTop).toBe(640)
  })

  // Asserted again after render, because the first lands while the previous page is still in the DOM.
  it('asserts the top again once the page has rendered', async () => {
    const { calls } = region(900)

    shellScrollBehavior(at('/textures'), at('/theme'), null)
    await settle()

    expect(calls.filter(call => call.top === 0).length).toBeGreaterThanOrEqual(2)
  })
})

describe('an anchor means that anchor', () => {
  // Resets to the top before the lookup, so a missing anchor leaves the user at the top.
  it('lands the panel on the top of the region', async () => {
    const { el, calls } = region(500)
    panel('nav-trail', 2307)

    shellScrollBehavior(at('/theme', '#nav-trail'), at('/textures'), null)
    await settle()

    expect(calls.map(call => call.top)).toEqual([500, 0, 2307])
    expect(el.scrollTop).toBe(2307)
  })

  // Offset by the region's top padding, so the section head is not behind the app bar.
  it('lands the panel clear of the chrome the region is padded for', async () => {
    const { el, calls } = region(0)
    el.style.paddingTop = '44px'
    panel('nav-trail', 2307)

    shellScrollBehavior(at('/theme', '#nav-trail'), at('/textures'), null)
    await settle()

    // 44 short of the panel's offset: its top edge on the first uncovered line.
    expect(calls.at(-1)?.top).toBe(2263)
  })

  // A page reached from another route has not rendered its panels yet.
  it('waits for a panel that has not rendered yet', async () => {
    const { el } = region(0)

    shellScrollBehavior(at('/theme', '#late'), at('/textures'), null)
    setTimeout(() => panel('late', 1200), 60)
    await new Promise(resolve => setTimeout(resolve, 300))

    expect(el.scrollTop).toBe(1200)
  })

  // The fallback when the anchor never appears.
  it('leaves the reader at the top when the anchor never comes', async () => {
    const { el } = region(2400)

    shellScrollBehavior(at('/theme', '#missing'), at('/textures'), null)
    await new Promise(resolve => setTimeout(resolve, 260))

    expect(el.scrollTop).toBe(0)
  })

  // Smooth only within the page already on screen; arriving on another page jumps.
  it('animates a jump within the page and not an arrival', async () => {
    const within = region(3206)
    panel('spacing', -1018)

    shellScrollBehavior(at('/theme', '#spacing'), at('/theme', '#type'), null)
    await settle()
    expect(within.calls.at(-1)?.behavior).toBe('smooth')

    document.body.innerHTML = ''
    const arriving = region(0)
    panel('spacing', 1200)

    shellScrollBehavior(at('/theme', '#spacing'), at('/textures'), null)
    await settle()
    expect(arriving.calls.at(-1)?.behavior).toBe('instant')
  })

  // Programmatic smooth scrolling ignores prefers-reduced-motion, so it is handled here.
  it('does not animate for a reader who asked for less motion', async () => {
    document.documentElement.dataset.motion = 'reduced'
    const { calls } = region(3206)
    panel('spacing', -1018)

    shellScrollBehavior(at('/theme', '#spacing'), at('/theme', '#type'), null)
    await settle()

    expect(calls.at(-1)?.behavior).toBe('instant')
  })
})

describe('a rewritten URL means do not move', () => {
  // useServerTable writes page, sort and search into the query on every keystroke.
  it('ignores a change that is only the query', async () => {
    const { el, calls } = region(390)

    shellScrollBehavior(at('/panels'), at('/panels'), null)
    await settle()

    expect(el.scrollTop).toBe(390)
    expect(calls).toEqual([])
  })

  it('still moves when the same path gains an anchor', async () => {
    const { el } = region(0)
    panel('type', 3206)

    shellScrollBehavior(at('/theme', '#type'), at('/theme'), null)
    await settle()

    expect(el.scrollTop).toBe(3206)
  })
})

describe('one navigation at a time', () => {
  // A smooth scroll or a panel wait can outlive the route that started it,
  // since the shell does not remount.
  it('abandons a pending anchor when another navigation starts', async () => {
    const { el } = region(0)

    shellScrollBehavior(at('/theme', '#slow'), at('/textures'), null)
    shellScrollBehavior(at('/panels'), at('/theme', '#slow'), null)

    // The panel the first navigation was waiting for arrives.
    setTimeout(() => panel('slow', 2400), 60)
    await new Promise(resolve => setTimeout(resolve, 300))

    expect(el.scrollTop).toBe(0)
  })

  // A smooth scroll cannot be aborted, only replaced by another one.
  it('stops an in-flight scroll before starting its own', async () => {
    const { calls } = region(640)

    shellScrollBehavior(at('/textures'), at('/theme'), null)
    await settle()

    expect(calls[0]).toEqual({ top: 640, behavior: 'instant' })
  })
})

describe('what else may read the page while this scrolls it', () => {
  // Marked before returning, because the scroll spy reacts on the same tick and
  // would otherwise read the pre-scroll position and rewrite the anchor.
  it('says so synchronously', () => {
    region(0)
    panel('spacing', 400)

    expect(scrollSettling()).toBe(false)
    shellScrollBehavior(at('/theme', '#spacing'), at('/theme'), null)
    expect(scrollSettling()).toBe(true)
  })

  it('and stops saying so once it has arrived', async () => {
    region(0)
    panel('spacing', 400)

    shellScrollBehavior(at('/theme', '#spacing'), at('/theme'), null)
    await new Promise(resolve => setTimeout(resolve, 400))

    expect(scrollSettling()).toBe(false)
  })

  // Including the branch with no anchor.
  it('and for a plain page too', async () => {
    region(900)

    shellScrollBehavior(at('/textures'), at('/theme'), null)
    expect(scrollSettling()).toBe(true)

    await new Promise(resolve => setTimeout(resolve, 400))
    expect(scrollSettling()).toBe(false)
  })
})

describe('a scroll the reader already made', () => {
  // The scroll spy writes the anchor into the URL as sections pass; that must not scroll.
  it('is not answered again', async () => {
    const { el, calls } = region(1200)
    panel('spacing', 400)

    quietScroll('/theme#spacing')
    shellScrollBehavior(at('/theme', '#spacing'), at('/theme'), null)
    await settle()

    expect(calls).toEqual([])
    expect(el.scrollTop).toBe(1200)
  })

  // The claim expires: vue-router can abandon the claimed `replace`, and a stale
  // claim would swallow the next real click to the same section.
  it('does not swallow a real navigation to the same section later', async () => {
    const { el } = region(1200)
    panel('spacing', 400)

    // Claimed for a navigation that never happens.
    quietScroll('/theme#spacing')
    await new Promise(resolve => setTimeout(resolve, 260))

    // A real click on that row.
    shellScrollBehavior(at('/theme', '#spacing'), at('/theme'), null)
    await settle()

    // The fixture's rect is fixed, so the offset reads 400 from a region at 1200.
    expect(el.scrollTop).toBe(1600)
  })
})

describe('the region itself', () => {
  // On a full page load the router runs before the app mounts, so the region does not exist yet.
  it('waits for a shell that has not mounted yet', async () => {
    let el: HTMLElement | null = null

    shellScrollBehavior(at('/theme', '#late-shell'), at('/'), null)
    setTimeout(() => {
      el = region(0).el
      panel('late-shell', 1800)
    }, 60)
    await new Promise(resolve => setTimeout(resolve, 320))

    expect(el).not.toBeNull()
    expect(el!.scrollTop).toBe(1800)
  })

  // Bounded, so a route naming an element that never renders does not wait indefinitely.
  it('gives up rather than waiting for ever', async () => {
    shellScrollBehavior(at('/theme', '#nothing'), at('/'), null)

    // No region or panel appears; nothing should throw or hang.
    await new Promise(resolve => setTimeout(resolve, 200))
    expect(document.querySelector('.shell__main')).toBeNull()
  })
})
