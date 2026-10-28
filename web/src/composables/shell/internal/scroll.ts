// web/src/composables/shell/internal/scroll.ts

/**
 * Scroll handling for UiAppShell, which scrolls `.shell__main` instead of the
 * window, so Vue Router's own `window.scrollTo` does nothing. Rules (see
 * tests/shell-scroll.spec.ts):
 *
 * - No anchor: scroll to the top, even when the path is unchanged.
 * - An anchor: scroll to it, or to the top if it never renders.
 * - Only the query changed (a table syncing its state): do not move.
 * - Within the current page: animate. Onto another page: jump.
 */

/** The route fields this module reads. */
export interface ScrollRoute {
  path: string
  hash: string
}

/** The part of Vue Router's savedPosition this module reads. */
export interface ScrollSaved {
  top?: number
}

/** The region UiAppShell scrolls. */
const REGION = '.shell__main'

/**
 * Module state on a `Symbol.for` cell, because the layer can be loaded as two
 * module instances (router options by path, composables by auto-import).
 */
interface ScrollState {
  /** Ticket of the current navigation; work for an older one stops. */
  latest: number
  /** How many scrolls started here have not landed. See `scrollSettling`. */
  landing: number
  /** Destinations whose scroll has already happened. See `quietScroll`. */
  quiet: Set<string>
}

const CELL = Symbol.for('s99ab.shell-scroll')
const shared = globalThis as unknown as Record<symbol, ScrollState | undefined>

const state: ScrollState = shared[CELL] ??= { latest: 0, landing: 0, quiet: new Set() }

/**
 * Suppresses the scroll for one navigation to `path + hash`, used when the
 * scroll spy rewrites the anchor. Expires, because vue-router often abandons
 * that replace and a stale claim would swallow the next real click.
 */
export function quietScroll(destination: string) {
  state.quiet.add(destination)
  setTimeout(() => state.quiet.delete(destination), 200)
}

/** Whether a scroll started here is still moving, so the scroll spy can ignore it. */
export function scrollSettling(): boolean {
  return state.landing > 0
}

/** Scrolls and resolves on arrival, or after a ceiling for a clamped scroll. */
async function land(main: Element, top: number, behavior: ScrollBehavior) {
  main.scrollTo({ top, behavior })

  const deadline = Date.now() + 1200
  for (;;) {
    await tick()
    if (Math.abs(main.scrollTop - top) <= 2 || Date.now() > deadline) break
  }
}

/** One tick: rAF or a timeout, since rAF pauses in a hidden tab. */
const tick = () => new Promise<void>((resolve) => {
  let done = false
  const once = () => {
    if (done) return
    done = true
    resolve()
  }

  if (typeof requestAnimationFrame === 'function') requestAnimationFrame(once)
  setTimeout(once, 32)
})

/**
 * Waits for an element to render (the region on first load, an anchor on a new
 * page). Gives up after `within` ms or when another navigation starts.
 */
async function settled<T extends Element>(
  find: () => T | null,
  ticket: number,
  within = 2000,
): Promise<T | null> {
  const deadline = Date.now() + within

  for (;;) {
    const found = find()
    if (found) return found
    if (ticket !== state.latest || Date.now() > deadline) return null
    await tick()
  }
}

/**
 * Where the region's content starts below its top edge. v-main pads for the app
 * bar inside the scroll box, so a section landed at 0 sits behind the bar.
 */
export function regionInset(region: Element): number {
  const style = getComputedStyle(region)

  // scroll-padding is what native fragment scrolling reads, so a click and a
  // pasted URL land on the same line. `auto` parses to NaN.
  const declared = Number.parseFloat(style.scrollPaddingTop)
  if (Number.isFinite(declared)) return region.clientTop + declared

  const padding = Number.parseFloat(style.paddingTop)
  return region.clientTop + (Number.isFinite(padding) ? padding : 0)
}

/** Reduced or off motion level. scrollTo ignores prefers-reduced-motion. */
function still(): boolean {
  const level = document.documentElement.dataset.motion
  return level === 'reduced' || level === 'off'
}

async function place(
  to: ScrollRoute,
  from: ScrollRoute,
  top: number,
  ticket: number,
) {
  // Only the query changed: do not move.
  if (to.path === from.path && to.hash === from.hash) return

  const main = await settled(() => document.querySelector(REGION), ticket)
  if (!main || ticket !== state.latest) return

  // Animate within the current page, including back to its top; jump between pages.
  const moved = to.path !== from.path
  const behavior = moved || still() ? 'instant' : 'smooth'

  // Stop an in-flight smooth scroll before the reset below.
  main.scrollTo({ top: main.scrollTop, behavior: 'instant' })

  if (!to.hash) {
    // No anchor: the top. Keyed on the anchor, since clicking the current page's
    // row keeps the path and drops the anchor.
    const arriving = land(main, top, behavior)

    // Again after the new page renders, since replaced content can move the
    // region. Skipped on the same page, where it would cut off the animation.
    if (moved) {
      await tick()
      if (ticket === state.latest) main.scrollTo({ top, behavior: 'instant' })
    }

    await arriving
    return
  }

  // Reset first, so an anchor that never renders leaves the user at the top.
  if (moved) main.scrollTo({ top, behavior: 'instant' })

  const target = await settled(() => document.getElementById(to.hash.slice(1)), ticket)
  if (!target || ticket !== state.latest) return

  // Relative to the region's content start. See regionInset.
  const y = target.getBoundingClientRect().top
    - main.getBoundingClientRect().top
    - regionInset(main)
    + main.scrollTop

  await land(main, y, behavior)
}

/**
 * The layer's scrollBehavior for `router.options.ts`. Schedules the scroll and
 * returns `false`, because Vue Router awaits the result and a navigation must
 * not wait on painting. An app can override it in its own router.options.ts
 * and call this from there.
 */
export function shellScrollBehavior(
  to: ScrollRoute,
  from: ScrollRoute,
  saved: ScrollSaved | null,
): false {
  // The scroll spy's own anchor rewrite: the user is already there.
  const destination = `${to.path}${to.hash}`
  if (state.quiet.delete(destination)) return false

  const ticket = ++state.latest

  // Marked synchronously, so the scroll spy reacting on this tick does not read
  // the pre-scroll position and rewrite the anchor back.
  state.landing++
  void place(to, from, saved?.top ?? 0, ticket).finally(() => {
    state.landing--
  })

  return false
}
