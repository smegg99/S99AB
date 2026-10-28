// web/src/composables/appearance/useEffects.ts

import { computed, onMounted, reactive, ref } from 'vue'
import { applyMotionLevel, motionLevel } from '../motion/internal/motion'

// Lite mode as a runtime preference; the default is `s99ab.performance.lite`.

export interface EffectsConfig {
  storageKey: string
  /** true = flat/lite, false = full effects. */
  liteDefault: boolean
}

export type EffectsConfigPatch = Partial<EffectsConfig>

// Set by the layer plugin from `s99ab.performance`.
const config = reactive<EffectsConfig>({
  storageKey: 's99ab.effects',
  liteDefault: false,
})

/** Called by the layer's Nuxt plugin with the app's effects config. */
export function configureEffects(patch: EffectsConfigPatch) {
  Object.assign(config, patch)
}

export function effectsConfig(): EffectsConfig {
  return config
}

// Module-level so every switch on a page reads one state.
const liteState = ref<boolean>(config.liteDefault)

/**
 * Sets `data-s99ab-lite` and the motion level together, since motion off is what
 * stops the drift and blur loaders. Off restores the configured motion level.
 */
export function applyLite(on: boolean) {
  liteState.value = on
  if (typeof document !== 'undefined') {
    const root = document.documentElement
    if (on) root.setAttribute('data-s99ab-lite', '')
    else root.removeAttribute('data-s99ab-lite')
  }
  applyMotionLevel(on ? 'off' : motionLevel())
}

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

/** Tests only. */
export function resetEffects() {
  Object.assign(config, { storageKey: 's99ab.effects', liteDefault: false })
  applyLite(false)
}
