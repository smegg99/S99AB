// web/src/composables/appearance/useThemePreference.ts

import { useAppearance } from './useAppearance'

/**
 * Light or dark, remembered across reloads. A thin view of useAppearance, which
 * owns both axes because Vuetify encodes them in one theme name.
 */
export function useThemePreference(storageKey: () => string = () => '') {
  const { dark, toggleTheme } = useAppearance(() => ({ theme: storageKey() }))

  return { dark, toggle: toggleTheme }
}
