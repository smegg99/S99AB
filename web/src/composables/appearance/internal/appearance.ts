// web/src/composables/appearance/internal/appearance.ts

import { reactive, ref, shallowRef } from 'vue'
import type { AppearanceConfig, AppearanceConfigPatch, AppearanceSource, ThemeMode, ContrastMode } from '../useAppearance'

// Set once per app, so every toggle writes the same keys.
export const config = reactive<AppearanceConfig>({
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

// One per process; a shallowRef so a late registration reaches mounted toggles.
export const source = shallowRef<AppearanceSource>({})

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
export const systemTick = ref(0)

/** Attaches to the current matchMedia and returns the teardown. */
export function listenForSystem(): () => void {
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

export function read(key: string): string | null {
  try {
    return localStorage.getItem(key)
  }
  catch {
    // Private mode and blocked storage both throw.
    return null
  }
}

export function write(key: string, value: string) {
  try {
    localStorage.setItem(key, value)
  }
  catch {
    // As above.
  }
}

export function erase(key: string) {
  try {
    localStorage.removeItem(key)
  }
  catch {
    // As above.
  }
}

// The user's pick per axis, as opposed to what it resolves to. Seeded from storage on mount.
export const themePref = ref<ThemeMode>('system')

export const contrastPref = ref<ContrastMode>('system')
