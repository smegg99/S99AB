// web/src/composables/appearance/useThemeTransition.ts

import { computed, readonly } from 'vue'
import { type ThemeTransition, THEME_TRANSITIONS, type ThemeTransitionConfig, config, resolvedTransition } from './internal/themeTransition'
import { writeStored } from '../../browser/storage'

export type { ThemeTransition, ThemeTransitionConfig } from './internal/themeTransition'
export type { TransitionOrigin } from './internal/cover'

export function useThemeTransitionConfig(): Readonly<ThemeTransitionConfig> {
  return readonly(config)
}

/** The user's stored choice. Everything else reads `resolvedTransition()`. */
export function useThemeTransition() {
  const current = computed<ThemeTransition>({
    get: () => resolvedTransition(),
    set: (next) => {
      writeStored(config.storageKey, next)
      // A picker re-reads the reactive config.
      config.transition = next
    },
  })

  return { current, options: THEME_TRANSITIONS, config: useThemeTransitionConfig() }
}
