// web/src/composables/appearance/useAppearance.ts

import { computed, onMounted, onScopeDispose, reactive, ref, shallowRef, watch } from 'vue'
import { useTheme } from 'vuetify'
import { previewColors, rebuildThemes, themeState } from '../../theme'
import { originOf, runThemeTransition, type ThemeTransition } from './useThemeTransition'

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

// Set once per app, so every toggle writes the same keys.
const config = reactive<AppearanceConfig>({
  storageKey: 's99ab.theme',
  contrastKey: '',
  lock: '',
})

/** Called by the layer's Nuxt plugin with the app's s99ab.appearance config. */
export function configureAppearance(patch: AppearanceConfigPatch) {
  Object.assign(config, patch)
}

export function appearanceConfig(): AppearanceConfig {
  return config
}

/** Whether the OS is asking for more contrast. False where it cannot be asked. */
export function prefersMoreContrast(): boolean {
  if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') {
    return false
  }
  return window.matchMedia('(prefers-contrast: more)').matches
}

/** Whether the OS is asking for a dark palette. False where it cannot be asked. */
export function prefersDark(): boolean {
  if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') {
    return false
  }
  return window.matchMedia('(prefers-color-scheme: dark)').matches
}

/**
 * An external source for the live appearance, such as a desktop shell's OS
 * watcher. A getter returning undefined falls through to the media query.
 */
export interface AppearanceSource {
  dark?: () => boolean | undefined
  contrast?: () => boolean | undefined
  accent?: () => string | undefined
}

// One per process; a shallowRef so a late registration reaches mounted toggles.
const source = shallowRef<AppearanceSource>({})

/**
 * Points the appearance at an external source, merged per axis. Used by the
 * s99wails bridge.
 */
export function registerAppearanceSource(patch: AppearanceSource): void {
  source.value = { ...source.value, ...patch }
}

/** Drops back to the OS media query on every axis. For tests and teardown. */
export function resetAppearanceSource(): void {
  source.value = {}
}

// Makes the OS preferences reactive, since matchMedia().matches is a plain read.
// Listeners attach per call site, so they bind to the matchMedia present then.
const systemTick = ref(0)

/** Attaches to the current matchMedia and returns the teardown. */
function listenForSystem(): () => void {
  if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') {
    return () => {}
  }

  const bump = () => systemTick.value++
  const lists = ['(prefers-color-scheme: dark)', '(prefers-contrast: more)']
    .map(query => window.matchMedia(query))

  for (const list of lists) list.addEventListener('change', bump)

  return () => {
    for (const list of lists) list.removeEventListener('change', bump)
  }
}

function read(key: string): string | null {
  try {
    return localStorage.getItem(key)
  }
  catch {
    // Private mode and blocked storage both throw.
    return null
  }
}

function write(key: string, value: string) {
  try {
    localStorage.setItem(key, value)
  }
  catch {
    // As above.
  }
}

function erase(key: string) {
  try {
    localStorage.removeItem(key)
  }
  catch {
    // As above.
  }
}

/** The three settings each axis offers: two explicit picks and "follow the OS". */
export type ThemeMode = 'light' | 'dark' | 'system'
export type ContrastMode = 'normal' | 'high' | 'system'

// The user's pick per axis, as opposed to what it resolves to. Seeded from storage on mount.
const themePref = ref<ThemeMode>('system')
const contrastPref = ref<ContrastMode>('system')

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
    theme: read(themeKey()),
    contrast: read(contrastKey()),
  })

  // Applies both axes. Contrast repaints the registered themes, since Vuetify
  // computes colours in JS from the palette object. The attribute is for _textures.scss.
  function apply(nextDark: boolean, nextHigh: boolean) {
    if (nextHigh !== high.value) {
      rebuildThemes(theme.themes.value, { high: nextHigh })

      if (typeof document !== 'undefined') {
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
    write(themeKey(), next ? 'dark' : 'light')
  }

  function toggleContrast(event?: Event, transition?: ThemeTransition) {
    const next = !high.value
    runThemeTransition(
      () => apply(dark.value, next),
      originOf(event),
      transition,
      groundFor(dark.value, next),
    )
    write(contrastKey(), next ? 'high' : 'normal')
  }

  // `system` erases the stored pick so the axis follows the OS; an explicit pick is stored.
  function setMode(next: ThemeMode, event?: Event, transition?: ThemeTransition) {
    themePref.value = next
    if (next === 'system') erase(themeKey())
    else write(themeKey(), next)

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
    if (next === 'system') erase(contrastKey())
    else write(contrastKey(), next === 'high' ? 'high' : 'normal')

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
