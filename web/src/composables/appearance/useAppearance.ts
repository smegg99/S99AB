// web/src/composables/appearance/useAppearance.ts

import { computed, onMounted, onScopeDispose, watch } from 'vue'
import { useTheme } from 'vuetify'
import { previewColors, rebuildThemes, themeState } from '../../theme'
import { originOf, runThemeTransition, type ThemeTransition } from './internal/themeTransition'

import { config, prefersMoreContrast, prefersDark, source, systemTick, listenForSystem, themePref, contrastPref } from './internal/appearance'
import { readStored, writeStored, eraseStored } from '../../browser/storage'
import { inBrowser } from '../../browser/env'

/**
 * Light/dark and contrast. Light and dark are the two registered themes;
 * contrast repaints both. State is module-level, so every toggle reads one answer.
 */
export interface AppearanceKeys {
  theme?: string
  /** Where normal/high contrast is remembered. Defaults to `<theme>.contrast`. */
  contrast?: string
}

/** From the app's `s99ab.appearance`, via the layer plugin. */
export interface AppearanceConfig {
  storageKey: string
  /** Empty means `<storageKey>.contrast`. */
  contrastKey: string
  /**
   * Pins light/dark for an app with a single palette. Storage and the OS are
   * ignored while set, and the toggles hide.
   */
  lock: '' | 'light' | 'dark'
}

export type AppearanceConfigPatch = Partial<AppearanceConfig>

/**
 * An external source for the live appearance, such as a desktop shell's OS
 * watcher. A getter returning undefined falls through to the media query.
 */
export interface AppearanceSource {
  dark?: () => boolean | undefined
  contrast?: () => boolean | undefined
  accent?: () => string | undefined
}

/** The three settings each axis offers: two explicit picks and "follow the OS". */
export type ThemeMode = 'light' | 'dark' | 'system'
export type ContrastMode = 'normal' | 'high' | 'system'

/**
 * Keys are getters so a changed prop is picked up. Unset, both come from
 * `s99ab.appearance`.
 */
export function useAppearance(keys: () => AppearanceKeys = () => ({})) {
  const theme = useTheme()

  // In setup: onScopeDispose needs an active effect scope, which onMounted lacks.
  onScopeDispose(listenForSystem())

  const themeKey = () => keys().theme || config.storageKey
  const contrastKey = () => keys().contrast || config.contrastKey || `${themeKey()}.contrast`

  // Read from the active theme, so an app's own registered theme also answers.
  const dark = computed(() => theme.global.current.value.dark)

  /** The app pinned this axis. */
  const locked = computed(() => config.lock !== '')
  const lockedDark = () => config.lock === 'dark'

  // Read from the theme module, which owns the repaint.
  const high = computed(() => themeState().high)

  /** The user's pick per axis. */
  const mode = computed(() => themePref.value)
  const contrastMode = computed(() => contrastPref.value)

  /** What the OS is asking for, live. */
  const system = computed(() => {
    void systemTick.value
    const src = source.value
    // A registered getter wins; undefined falls through to the media query.
    return {
      dark: src.dark?.() ?? prefersDark(),
      high: src.contrast?.() ?? prefersMoreContrast(),
    }
  })

  // The source's accent, or undefined to keep the built-in accent. Never stored.
  const sourceAccent = computed(() => source.value.accent?.())

  const accent = computed(() => themeState().accent)

  /** Whether the user has stored a choice on either axis. */
  const stored = () => ({
    theme: readStored(themeKey()),
    contrast: readStored(contrastKey()),
  })

  // Applies both axes. Contrast repaints the registered themes, since Vuetify
  // computes colours in JS from the palette object. The attribute is for _textures.scss.
  function apply(nextDark: boolean, nextHigh: boolean) {
    if (nextHigh !== high.value) {
      rebuildThemes(theme.themes.value, { high: nextHigh })

      if (inBrowser()) {
        const root = document.documentElement
        if (nextHigh) root.setAttribute('data-contrast', 'high')
        else root.removeAttribute('data-contrast')
      }
    }

    void theme.change(nextDark ? 'dark' : 'light')
  }

  // The ground the next appearance will have, computed in advance so a cover
  // transition can flood with it before the change lands.
  function groundFor(nextDark: boolean, nextHigh: boolean): string | undefined {
    const colors = previewColors(nextDark, nextHigh)
    return colors.bg ?? colors.background
  }

  // The change runs inside the transition callback. Without an event the shape
  // opens from the window's centre.
  function toggleTheme(event?: Event, transition?: ThemeTransition) {
    const next = !dark.value
    runThemeTransition(
      () => apply(next, high.value),
      originOf(event),
      transition,
      groundFor(next, high.value),
    )
    writeStored(themeKey(), next ? 'dark' : 'light')
  }

  function toggleContrast(event?: Event, transition?: ThemeTransition) {
    const next = !high.value
    runThemeTransition(
      () => apply(dark.value, next),
      originOf(event),
      transition,
      groundFor(dark.value, next),
    )
    writeStored(contrastKey(), next ? 'high' : 'normal')
  }

  // `system` erases the stored pick so the axis follows the OS; an explicit pick is stored.
  function setMode(next: ThemeMode, event?: Event, transition?: ThemeTransition) {
    themePref.value = next
    if (next === 'system') eraseStored(themeKey())
    else writeStored(themeKey(), next)

    const nextDark = next === 'system' ? system.value.dark : next === 'dark'
    runThemeTransition(
      () => apply(nextDark, high.value),
      originOf(event),
      transition,
      groundFor(nextDark, high.value),
    )
  }

  function setContrast(next: ContrastMode, event?: Event, transition?: ThemeTransition) {
    contrastPref.value = next
    if (next === 'system') eraseStored(contrastKey())
    else writeStored(contrastKey(), next === 'high' ? 'high' : 'normal')

    const nextHigh = next === 'system' ? system.value.high : next === 'high'
    runThemeTransition(
      () => apply(dark.value, nextHigh),
      originOf(event),
      transition,
      groundFor(dark.value, nextHigh),
    )
  }

  // Rebuilds both themes with a new accent; contrast is unchanged.
  function applyAccent(next: string | undefined) {
    rebuildThemes(theme.themes.value, { accent: next })
  }

  // The animated path for a themer or settings screen. Persisting is the caller's job.
  function setAccent(next: string | undefined, event?: Event, transition?: ThemeTransition) {
    runThemeTransition(
      () => applyAccent(next),
      originOf(event),
      transition,
      groundFor(dark.value, high.value),
    )
  }

  /*
    Restored on mount, since localStorage is absent under SSR. Both axes resolve
    before one apply, starting from the OS; a stored value wins.
  */
  onMounted(() => {
    const { theme: storedTheme, contrast: storedContrast } = stored()

    // Seed the user's pick, so a segmented control shows the right segment.
    themePref.value = storedTheme === 'dark' ? 'dark' : storedTheme === 'light' ? 'light' : 'system'
    contrastPref.value = storedContrast === 'high' ? 'high' : storedContrast === 'normal' ? 'normal' : 'system'

    const nextDark = locked.value
      ? lockedDark()
      : storedTheme === 'light'
        ? false
        : storedTheme === 'dark' ? true : system.value.dark

    const nextHigh = storedContrast === 'high'
      ? true
      : storedContrast === 'normal' ? false : system.value.high

    // Applied without a transition: this is the first paint correcting itself.
    if (nextDark !== dark.value || nextHigh !== high.value) apply(nextDark, nextHigh)

    // The source's accent, also applied directly.
    if (sourceAccent.value !== undefined) applyAccent(sourceAccent.value)

    // Follow the OS on any axis the user has not set. Depends on the system
    // values only, so a toggle does not re-assert the system over the user's pick.
    watch(
      () => [system.value.dark, system.value.high].join(),
      () => {
        const now = stored()
        apply(
          // A pinned axis does not follow the OS either.
          locked.value ? lockedDark() : now.theme ? dark.value : system.value.dark,
          now.contrast ? high.value : system.value.high,
        )
      },
    )

    // A source that stops reporting an accent leaves the last one in place.
    watch(sourceAccent, (next) => {
      if (next !== undefined) applyAccent(next)
    })
  })

  return {
    locked,
    dark,
    high,
    mode,
    contrastMode,
    system,
    accent,
    toggleTheme,
    toggleContrast,
    setMode,
    setContrast,
    setAccent,
  }
}
