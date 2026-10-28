// web/src/composables/motion/useMotion.ts

import { computed, readonly, ref } from 'vue'
import { type MotionLevel, config, resolveLevel, applyMotionLevel } from './internal/motion'
import { onMediaChange } from '../../browser/media'

export type { MotionConfig, MotionConfigPatch, MotionLevel, ResolvedMotionLevel } from './internal/motion'

export type MotionName = 'fade' | 'slide-up' | 'slide-end' | 'scale' | 'swap' | 'toast'

// Bumped when the OS preference changes, so `resolved` re-evaluates; matchMedia
// reads are not reactive. Attached on first use, not at import, and kept for the page.
const systemTick = ref(0)
let watching = false

export function useMotion() {
  if (!watching) {
    watching = true
    onMediaChange(['(prefers-reduced-motion: reduce)'], () => systemTick.value++)
  }
  const level = computed(() => config.level)
  const resolved = computed(() => {
    void systemTick.value
    return resolveLevel(config.level)
  })

  function setLevel(next: MotionLevel) {
    config.level = next
    applyMotionLevel(next)
  }

  /**
   * The transition name for a preset, or '' when motion is off. UiMotion skips
   * Transition entirely for '', since a nameless Transition still adds classes.
   */
  function nameFor(name: MotionName): string {
    return resolved.value === 'off' ? '' : `motion-${name}`
  }

  return {
    config: readonly(config),
    level,
    resolved,
    setLevel,
    nameFor,
  }
}
