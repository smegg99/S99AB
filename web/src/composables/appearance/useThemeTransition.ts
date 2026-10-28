// web/src/composables/appearance/useThemeTransition.ts

import { computed, readonly } from 'vue'
import { type ThemeTransition, THEME_TRANSITIONS, type ThemeTransitionConfig, config, resolvedTransition } from './internal/themeTransition'

export type { ThemeTransition, ThemeTransitionConfig, TransitionOrigin } from './internal/themeTransition'

export function useThemeTransitionConfig(): Readonly<ThemeTransitionConfig> {
  return readonly(config)
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
