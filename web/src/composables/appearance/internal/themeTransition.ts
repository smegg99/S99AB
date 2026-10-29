// web/src/composables/appearance/internal/themeTransition.ts

import { reactive } from 'vue'
import { mergeConfig } from '../../../internal/config'
import { readStored } from '../../../browser/storage'

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

export const config = reactive<ThemeTransitionConfig>({
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
  mergeConfig(config, patch, ['durations', 'easings'])
}

/** ms for one shape: its own, or the shared default. */
export function durationFor(kind: ThemeTransition): number {
  return config.durations[kind] ?? config.duration
}

/** The curve for one shape, or '' to leave it to the stylesheet. */
export function easingFor(kind: ThemeTransition): string {
  return config.easings[kind] ?? config.easing
}

export function read(): ThemeTransition | null {
  const stored = readStored(config.storageKey)
  return isTransition(stored) ? stored : null
}

export function isTransition(value: unknown): value is ThemeTransition {
  return THEME_TRANSITIONS.includes(value as ThemeTransition)
}

/** The user's choice if made, the app's default otherwise. */
export function resolvedTransition(): ThemeTransition {
  return read() ?? config.transition
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
