// web/src/composables/appearance/internal/effects.ts

import { reactive, ref } from 'vue'
import { applyMotionLevel, motionLevel } from '../../motion/internal/motion'
import type { EffectsConfig, EffectsConfigPatch } from '../useEffects'

// Set by the layer plugin from `s99ab.performance`.
export const config = reactive<EffectsConfig>({
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
export const liteState = ref<boolean>(config.liteDefault)

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

/** Tests only. */
export function resetEffects() {
  Object.assign(config, { storageKey: 's99ab.effects', liteDefault: false })
  applyLite(false)
}
