// web/src/composables/motion/internal/motion.ts

import { reactive } from 'vue'
import { mediaMatches } from '../../../browser/media'
import { inBrowser } from '../../../browser/env'

/** `reduced` keeps fades and drops movement; `off` removes both. */
export type MotionLevel = 'system' | 'full' | 'reduced' | 'off'

/** What the level resolves to once `system` is answered. */
export type ResolvedMotionLevel = Exclude<MotionLevel, 'system'>

export interface MotionConfig {
  level: MotionLevel
  duration: { fast: number, base: number, slow: number }
  easing: { standard: string, enter: string, exit: string }
}

/** A partial override; unset durations keep their values. */
export type MotionConfigPatch = Partial<
  Omit<MotionConfig, 'duration' | 'easing'>
> & {
  duration?: Partial<MotionConfig['duration']>
  easing?: Partial<MotionConfig['easing']>
}

export const config = reactive<MotionConfig>({
  level: 'system',
  duration: { fast: 120, base: 200, slow: 320 },
  easing: {
    standard: 'cubic-bezier(.2,0,0,1)',
    enter: 'cubic-bezier(0,0,0,1)',
    exit: 'cubic-bezier(.3,0,1,1)',
  },
})

/** Called by the layer's Nuxt plugin with the app's s99ab.motion config. */
export function configureMotion(patch: MotionConfigPatch) {
  // Merge the nested maps so a patch setting one duration keeps the rest.
  const { duration, easing, ...rest } = patch
  Object.assign(config, rest)
  if (duration) Object.assign(config.duration, duration)
  if (easing) Object.assign(config.easing, easing)
}

/** The configured level, read once without a computed. */
export function motionLevel(): MotionLevel {
  return config.level
}

/** Whether the OS asks for reduced motion. False where matchMedia is absent. */
export function prefersReducedMotion(): boolean {
  return mediaMatches('(prefers-reduced-motion: reduce)')
}

export function resolveLevel(level: MotionLevel): ResolvedMotionLevel {
  if (level !== 'system') return level
  return prefersReducedMotion() ? 'reduced' : 'full'
}

/** Writes the level onto the document root; CSS handles the rest. */
export function applyMotionLevel(level: MotionLevel) {
  if (!inBrowser()) return
  document.documentElement.dataset.motion = level
}

/** Tests only. */
export function resetMotion() {
  configureMotion({
    level: 'system',
    duration: { fast: 120, base: 200, slow: 320 },
    easing: {
      standard: 'cubic-bezier(.2,0,0,1)',
      enter: 'cubic-bezier(0,0,0,1)',
      exit: 'cubic-bezier(.3,0,1,1)',
    },
  })
}
