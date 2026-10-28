// web/src/composables/appearance/useEffects.ts

import { computed, onMounted } from 'vue'
import { config, liteState, applyLite } from './internal/effects'

// Lite mode as a runtime preference; the default is `s99ab.performance.lite`.

export interface EffectsConfig {
  storageKey: string
  /** true = flat/lite, false = full effects. */
  liteDefault: boolean
}

export type EffectsConfigPatch = Partial<EffectsConfig>

function read(key: string): string | null {
  try {
    return localStorage.getItem(key)
  }
  catch {
    // Private mode and blocked storage throw.
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

/** Restored on mount, since localStorage is absent under SSR. */
export function useEffects() {
  const lite = computed(() => liteState.value)
  const effects = computed(() => !liteState.value)

  function setLite(next: boolean) {
    applyLite(next)
    // Stored as words, so an unknown value falls back to the default.
    write(config.storageKey, next ? 'lite' : 'full')
  }

  function setEffects(next: boolean) {
    setLite(!next)
  }

  function toggleEffects() {
    setLite(!liteState.value)
  }

  onMounted(() => {
    const stored = read(config.storageKey)
    const next = stored === 'lite'
      ? true
      : stored === 'full' ? false : config.liteDefault
    if (next !== liteState.value) applyLite(next)
  })

  return { lite, effects, setEffects, toggleEffects }
}
