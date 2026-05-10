// web/src/composables/appearance/useThemeTransition.ts

import { computed, reactive, readonly } from 'vue'
import { motionLevel, resolveLevel } from '../motion/useMotion'

/**
 * How the screen changes appearance. `cover`, `cover-in`, `veil` and the `wipe`
 * family animate `transform`/`opacity` on one element, which stays on the
 * compositor. The circles, the `sweep` family and `split` are View Transition
 * clip-paths over two snapshots. `fade` dissolves; `none` is instant.
 */
export type ThemeTransition
  = 'cover' | 'cover-in'
    | 'veil'
    | 'wipe' | 'wipe-up' | 'wipe-start' | 'wipe-end'
    | 'circle' | 'circle-in'
    | 'sweep' | 'sweep-up' | 'sweep-start' | 'sweep-end'
    | 'split' | 'fade' | 'none'

/**
 * The cover shapes: arrive, hold with the change applied underneath, leave.
 * `sheet` is the viewport; `disc` is seeded small and scaled up (see runCover).
 */
interface CoverMove {
  shape: 'disc' | 'sheet'
  in: (to: number) => Keyframe[]
  out: (to: number) => Keyframe[]
}

const fadeIn = (): Keyframe[] => [{ opacity: 0 }, { opacity: 1 }]
const fadeOut = (): Keyframe[] => [{ opacity: 1 }, { opacity: 0 }]
const slide = (from: string, to: string) => (): Keyframe[] =>
  [{ transform: `translate${from}` }, { transform: `translate${to}` }]

const COVER_MOVES: Partial<Record<ThemeTransition, CoverMove>> = {
  'cover': {
    shape: 'disc',
    in: to => [{ transform: 'scale(0)' }, { transform: `scale(${to})` }],
    out: fadeOut,
  },
  'cover-in': {
    shape: 'disc',
    in: to => [{ transform: 'scale(0)' }, { transform: `scale(${to})` }],
    out: to => [{ transform: `scale(${to})` }, { transform: 'scale(0)' }],
  },
  // Nothing moves, so nothing re-rasterises: the choice for a slow machine.
  'veil': { shape: 'sheet', in: fadeIn, out: fadeOut },
  // Leaves forward instead of reversing.
  'wipe': { shape: 'sheet', in: slide('Y(-100%)', 'Y(0)'), out: slide('Y(0)', 'Y(100%)') },
  'wipe-up': { shape: 'sheet', in: slide('Y(100%)', 'Y(0)'), out: slide('Y(0)', 'Y(-100%)') },
  'wipe-start': { shape: 'sheet', in: slide('X(-100%)', 'X(0)'), out: slide('X(0)', 'X(100%)') },
  'wipe-end': { shape: 'sheet', in: slide('X(100%)', 'X(0)'), out: slide('X(0)', 'X(-100%)') },
}

/** Which shapes are the cover family. */
export const COVER_SHAPES = new Set<ThemeTransition>(
  Object.keys(COVER_MOVES) as ThemeTransition[],
)

/** Picker order, grouped by shape: circles, blinds, then the undirected ones. */
export const THEME_TRANSITIONS: readonly ThemeTransition[] = [
  'cover', 'cover-in', 'veil',
  'wipe', 'wipe-up', 'wipe-start', 'wipe-end',
  'circle', 'circle-in',
  'sweep', 'sweep-up', 'sweep-start', 'sweep-end',
  'split', 'fade', 'none',
] as const

export interface ThemeTransitionConfig {
  /** The app's default. The user's own choice wins over it. */
  transition: ThemeTransition

  /** ms for any shape without its own. Longer than `slow`, since shapes cross the window. */
  duration: number

  /**
   * ms per shape, over `duration`. Cover shapes split their time three ways
   * (arrive, hold, leave), so they get longer defaults.
   */
  durations: Partial<Record<ThemeTransition, number>>

  /** The default curve. Empty uses the stylesheet's `$vt-easing`. */
  easing: string

  /** The curve per shape, over `easing`. */
  easings: Partial<Record<ThemeTransition, string>>

  /** What `reduced` motion resolves every shape to. */
  reducedFallback: ThemeTransition

  /**
   * Whether `none` also suppresses the page's CSS transitions, which Vuetify's
   * hover states would otherwise turn into a fade.
   */
  suppressTransitions: boolean

  /** Where the user's choice is stored. */
  storageKey: string
}

const config = reactive<ThemeTransitionConfig>({
  // `cover` keeps its frame rate where `circle` may not.
  transition: 'cover',
  duration: 440,
  durations: {
    'cover': 720,
    'cover-in': 780,
    'veil': 600,
    'wipe': 720,
    'wipe-up': 720,
    'wipe-start': 800,
    'wipe-end': 800,
  },
  easing: '',
  easings: {},
  reducedFallback: 'fade',
  suppressTransitions: true,
  storageKey: 's99ab.theme.transition',
})

/** Called by the layer's Nuxt plugin. The per-shape maps are merged, not replaced. */
export function configureThemeTransition(patch: Partial<ThemeTransitionConfig>) {
  const { durations, easings, ...rest } = patch

  Object.assign(config, rest)
  if (durations) Object.assign(config.durations, durations)
  if (easings) Object.assign(config.easings, easings)
}

/** ms for one shape: its own, or the shared default. */
export function durationFor(kind: ThemeTransition): number {
  return config.durations[kind] ?? config.duration
}

/** The curve for one shape, or '' to leave it to the stylesheet. */
export function easingFor(kind: ThemeTransition): string {
  return config.easings[kind] ?? config.easing
}

export function useThemeTransitionConfig(): Readonly<ThemeTransitionConfig> {
  return readonly(config)
}

function read(): ThemeTransition | null {
  try {
    const stored = localStorage.getItem(config.storageKey)
    return isTransition(stored) ? stored : null
  }
  catch {
    // Private mode and blocked storage both throw; the app default applies.
    return null
  }
}

function isTransition(value: unknown): value is ThemeTransition {
  return THEME_TRANSITIONS.includes(value as ThemeTransition)
}

/** The user's choice if made, the app's default otherwise. */
export function resolvedTransition(): ThemeTransition {
  return read() ?? config.transition
}

type StartViewTransition = (callback: () => void) => { finished: Promise<void> }

/**
 * The browser's startViewTransition, or null. Read at call time. Narrowed through
 * `unknown` because the DOM types declare it as always present.
 */
function viewTransitions(): StartViewTransition | null {
  if (typeof document === 'undefined') return null

  const start = (document as unknown as { startViewTransition?: unknown }).startViewTransition
  return typeof start === 'function'
    ? (start as StartViewTransition).bind(document)
    : null
}

export interface TransitionOrigin {
  x: number
  y: number
}

/**
 * Runs `apply` inside the browser's transition callback; it must be synchronous.
 * Falls through to `apply()` when the transition, motion or the API is off.
 */
export function runThemeTransition(
  apply: () => void,
  origin?: TransitionOrigin,
  override?: ThemeTransition,
  coverInk?: string,
) {
  // `override` previews one shape without changing the stored choice.
  const kind = override ?? resolvedTransition()

  // `off` allows no animation; `reduced` still allows a fade.
  const level = resolveLevel(motionLevel())
  const allowed = level === 'off'
    ? 'none'
    : level === 'reduced' && kind !== 'none' ? config.reducedFallback : kind

  // Cover shapes need no View Transitions API, so they run first.
  if (COVER_SHAPES.has(allowed) && canAnimate()) {
    runCover(apply, allowed, origin ?? centre(), coverInk)
    return
  }

  const start = viewTransitions()
  if (allowed === 'none' || !start) {
    if (config.suppressTransitions) applyInstantly(apply)
    else apply()
    return
  }

  const root = document.documentElement
  const point = origin ?? centre()

  // The clip-path reads these custom properties.
  root.style.setProperty('--s99ab-vt-x', `${point.x}px`)
  root.style.setProperty('--s99ab-vt-y', `${point.y}px`)
  root.style.setProperty('--s99ab-vt-r', `${coverRadius(point)}px`)
  root.style.setProperty('--s99ab-vt-duration', `${durationFor(allowed)}ms`)

  // Only when the app set one; otherwise the stylesheet's $vt-easing applies.
  const easing = easingFor(allowed)
  if (easing) root.style.setProperty('--s99ab-vt-easing', easing)
  else root.style.removeProperty('--s99ab-vt-easing')
  root.dataset.s99abVt = allowed

  // Suppressed so the "after" snapshot is not captured mid-interpolation.
  const transition = start(() => {
    if (config.suppressTransitions) applyInstantly(apply)
    else apply()
  })

  // Cleared on both arms instead of `finally`: a hidden tab rejects with
  // InvalidStateError, and `finally` would leave that rejection unhandled.
  const clear = () => {
    delete root.dataset.s99abVt
  }
  transition.finished.then(clear, clear)
}

/** Whether an element can be animated at all here. */
function canAnimate(): boolean {
  return typeof document !== 'undefined'
    && typeof document.body?.animate === 'function'
}

/**
 * A disc of the incoming colour, out from the point and off again. Animates
 * transform and opacity only and takes no snapshots; the change lands while the
 * disc covers the screen.
 */
function runCover(
  apply: () => void,
  kind: ThemeTransition,
  origin: TransitionOrigin,
  ink?: string,
) {
  const move = COVER_MOVES[kind]!
  const total = durationFor(kind)
  const easing = easingFor(kind) || 'cubic-bezier(0, 0, 0.2, 1)'

  const el = document.createElement('div')
  el.className = `s99ab-vt-cover s99ab-vt-cover--${move.shape}`

  // Seeded small and scaled up, so the layer is not an 8,400px texture to raster.
  let to = 1
  if (move.shape === 'disc') {
    const radius = coverRadius(origin)
    const seed = Math.max(coverSeed(), 8)

    to = (radius * 2) / seed
    el.style.insetInlineStart = `${origin.x - seed / 2}px`
    el.style.insetBlockStart = `${origin.y - seed / 2}px`
    el.style.width = `${seed}px`
    el.style.height = `${seed}px`
  }

  // The incoming ground, passed in because `--v-theme-bg` still resolves to the
  // outgoing theme until `apply` runs.
  if (ink) el.style.background = ink

  document.body.append(el)

  const hold = coverHold()
  const arrive = Math.round(total * coverShare())
  const leave = Math.max(total - arrive, 0)

  // The sheet is removed however the animation ends.
  const done = () => el.remove()

  const startLeave = () => {
    const out = el.animate(move.out(to), { duration: leave, easing, fill: 'forwards' })
    out.finished.then(done, done)
  }

  const swap = () => {
    // Vuetify's per-element colour transitions are suppressed while the sheet
    // covers the screen, or the page keeps changing colour after it leaves.
    if (config.suppressTransitions) applyInstantly(apply)
    else apply()
  }

  const inward = el.animate(move.in(to), { duration: arrive, easing, fill: 'forwards' })

  // The change lands at the start of the hold.
  inward.finished.then(
    () => {
      swap()
      if (hold > 0) setTimeout(startLeave, hold)
      else startLeave()
    },
    () => {
      apply()
      done()
    },
  )
}

/** A knob as a number, or the fallback before the stylesheet loads. */
function knob(name: string, fallback: number): number {
  if (typeof document === 'undefined') return fallback

  const raw = getComputedStyle(document.documentElement).getPropertyValue(name)
  const value = Number.parseFloat(raw)
  return Number.isFinite(value) ? value : fallback
}

/** Fraction of a cover shape's time spent arriving, clamped to leave time to leave. */
function coverShare(): number {
  return Math.min(Math.max(knob('--s99ab-vt-cover-in', 0.6), 0.1), 0.9)
}

/** The disc's size before scaling. */
function coverSeed(): number {
  return knob('--s99ab-vt-cover-seed', 240)
}

/** How long it holds full cover while the change lands. */
function coverHold(): number {
  return Math.max(knob('--s99ab-vt-cover-hold', 90), 0)
}

function centre(): TransitionOrigin {
  if (typeof window === 'undefined') return { x: 0, y: 0 }
  return { x: window.innerWidth / 2, y: window.innerHeight / 2 }
}

/**
 * The circle's end radius from `point`: the hypotenuse to the farther half on
 * each axis. A length, since circle() rejects `farthest-corner`.
 */
export function coverRadius(point: TransitionOrigin): number {
  if (typeof window === 'undefined') return 0

  const x = Math.max(point.x, window.innerWidth - point.x)
  const y = Math.max(point.y, window.innerHeight - point.y)
  return Math.hypot(x, y)
}

/** Applies the change with page CSS transitions suppressed for one frame. */
function applyInstantly(apply: () => void) {
  if (typeof document === 'undefined') {
    apply()
    return
  }

  const root = document.documentElement
  root.dataset.s99abVtInstant = ''
  apply()

  // Forces the new values to commit while suppression is on.
  void root.offsetHeight

  requestAnimationFrame(() => {
    delete root.dataset.s99abVtInstant
  })
}

/** Where a click happened, for a toggle that has the event in hand. */
export function originOf(event?: Event): TransitionOrigin | undefined {
  const pointer = event as MouseEvent | undefined
  if (!pointer || typeof pointer.clientX !== 'number') return undefined

  // Keyboard activation reports 0,0; use the button's position instead.
  if (pointer.clientX === 0 && pointer.clientY === 0) {
    const target = pointer.currentTarget as HTMLElement | null
    if (!target?.getBoundingClientRect) return undefined

    const box = target.getBoundingClientRect()
    return { x: box.left + box.width / 2, y: box.top + box.height / 2 }
  }
  return { x: pointer.clientX, y: pointer.clientY }
}

/** The user's stored choice. Everything else reads `resolvedTransition()`. */
export function useThemeTransition() {
  const current = computed<ThemeTransition>({
    get: () => resolvedTransition(),
    set: (next) => {
      try {
        localStorage.setItem(config.storageKey, next)
      }
      catch {
        // As above.
      }
      // A picker re-reads the reactive config.
      config.transition = next
    },
  })

  return { current, options: THEME_TRANSITIONS, config: useThemeTransitionConfig() }
}

/** Tests only. */
export function resetThemeTransition() {
  config.transition = 'cover'
  config.duration = 440
  config.durations = {
    'cover': 720,
    'cover-in': 780,
    'veil': 600,
    'wipe': 720,
    'wipe-up': 720,
    'wipe-start': 800,
    'wipe-end': 800,
  }
  config.easing = ''
  config.easings = {}
  config.reducedFallback = 'fade'
  config.suppressTransitions = true
  config.storageKey = 's99ab.theme.transition'
}
