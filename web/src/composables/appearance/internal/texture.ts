// web/src/composables/appearance/internal/texture.ts

import { reactive } from 'vue'
import type { TextureSpec, PlaneName, TextureConfig, TextureConfigPatch } from '../useTexture'
import { inBrowser } from '../../../browser/env'

/**
 * Every texture with a file. `none` has no file and is added by `options`.
 * Must match _textures.scss and public/textures; tests/texture.spec.ts checks.
 */
export const TEXTURES: readonly TextureSpec[] = [
  { name: 'grain', family: 'grain', intensity: 'quiet' },
  { name: 'paper', family: 'grain', intensity: 'quiet' },
  { name: 'static', family: 'grain', intensity: 'loud' },

  { name: 'newsprint', family: 'print', intensity: 'quiet' },
  { name: 'halftone', family: 'print', intensity: 'medium' },
  { name: 'riso', family: 'print', intensity: 'medium' },

  { name: 'hatch', family: 'line', intensity: 'quiet' },
  { name: 'crosshatch', family: 'line', intensity: 'medium' },
  { name: 'pinstripe', family: 'line', intensity: 'quiet' },
  { name: 'scanline', family: 'line', intensity: 'medium' },
  { name: 'corduroy', family: 'line', intensity: 'quiet' },
  { name: 'engrave', family: 'line', intensity: 'medium' },
  { name: 'bars', family: 'line', intensity: 'loud' },
  { name: 'wave', family: 'line', intensity: 'medium' },
  { name: 'zigzag', family: 'line', intensity: 'medium' },
  { name: 'rain', family: 'line', intensity: 'quiet' },

  { name: 'dots', family: 'grid', intensity: 'quiet' },
  { name: 'grid', family: 'grid', intensity: 'quiet' },
  { name: 'graph', family: 'grid', intensity: 'medium' },
  { name: 'crosses', family: 'grid', intensity: 'quiet' },
  { name: 'ticks', family: 'grid', intensity: 'quiet' },
  { name: 'mesh', family: 'grid', intensity: 'medium' },
  { name: 'perforate', family: 'grid', intensity: 'medium' },

  { name: 'check', family: 'geometric', intensity: 'loud' },
] as const

/** Every plane, in the order the demo's controls list them. */
export const PLANES: readonly PlaneName[] = [
  'ground',
  'chrome',
  'well',
  'overlay',
] as const

export const NO_PLANE_STRINGS: Record<PlaneName, string> = {
  ground: '',
  chrome: '',
  well: '',
  overlay: '',
}

/** The layer's plane strengths, exported for resets and the themer. */
export const DEFAULT_PLANES: Record<PlaneName, number> = {
  ground: 0.16,
  chrome: 0.09,
  well: 0.06,
  overlay: 0.08,
}

// Defaults; must match _config.scss, which applies before this runs.
export const config = reactive<TextureConfig>({
  name: 'grain',
  gain: 1,
  scale: 1,
  ink: '',
  planes: { ...DEFAULT_PLANES },
  // Every plane follows `name` by default.
  textures: { ...NO_PLANE_STRINGS },
  storageKey: 's99ab.texture',
})

/** Whether this build has a file for the name. */
export function knownTexture(name: string): boolean {
  return name === 'none' || TEXTURES.some(spec => spec.name === name)
}

/** Called by the layer's Nuxt plugin. Unknown texture names are dropped. */
export function configureTexture(patch: TextureConfigPatch) {
  // Merge nested maps separately; spreading would replace them.
  const { planes, textures, name, ...rest } = patch

  Object.assign(config, rest)
  if (name && knownTexture(name)) config.name = name
  if (planes) Object.assign(config.planes, planes)

  // Empty is kept: it clears a plane back to following `name`.
  if (textures) {
    for (const [plane, texture] of Object.entries(textures)) {
      if (texture === '' || knownTexture(texture)) {
        config.textures[plane as PlaneName] = texture
      }
    }
  }
}

/** The configured texture, without a computed. */
export function textureConfig(): TextureConfig {
  return config
}

/** Merges the patch, then writes the configuration onto the document element. */
export function applyTexture(patch: TextureConfigPatch = {}) {
  configureTexture(patch)

  // SSR has no document; the stylesheet defaults apply until the client runs.
  if (!inBrowser()) return

  const root = document.documentElement

  root.setAttribute('data-texture', config.name)

  root.style.setProperty('--s99ab-tex-gain', String(config.gain))
  root.style.setProperty('--s99ab-tex-scale', String(config.scale))

  // An empty ink would override the stylesheet's with nothing.
  if (config.ink) root.style.setProperty('--s99ab-tex-ink', config.ink)

  for (const plane of PLANES) {
    root.style.setProperty(`--s99ab-tex-${plane}`, String(config.planes[plane]))

    // Remove the attribute when a plane states nothing.
    const texture = config.textures[plane]
    if (texture) root.setAttribute(`data-tex-${plane}`, texture)
    else root.removeAttribute(`data-tex-${plane}`)
  }
}
