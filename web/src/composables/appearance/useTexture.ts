// web/src/composables/appearance/useTexture.ts

import { computed, reactive } from 'vue'

// Which texture each surface plane wears, and how strongly. Written as custom
// properties on the document element, so surfaces the layer does not own get them too.

export type TextureFamily
  = | 'grain' | 'print' | 'line' | 'grid' | 'geometric'

export interface TextureSpec {
  /** The filename under public/textures, without the extension. */
  name: string
  family: TextureFamily
  /** Shown by the demo; unused here. */
  intensity: 'quiet' | 'medium' | 'loud'
}

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

/** The kinds of surface a texture can be assigned to. See $tex-planes. */
export type PlaneName = 'ground' | 'chrome' | 'well' | 'overlay'

/** Every plane, in the order the demo's controls list them. */
export const PLANES: readonly PlaneName[] = [
  'ground',
  'chrome',
  'well',
  'overlay',
] as const

export interface TextureConfig {
  /** The default texture for every plane: a name from TEXTURES, or 'none'. */
  name: string
  /** Multiplier over every plane's strength. 0 is off. */
  gain: number
  /** Multiplies every texture's natural tile. */
  scale: number
  /** Empty keeps the stylesheet's ink. */
  ink: string
  /** How much ink each plane keeps. */
  planes: Record<PlaneName, number>
  /**
   * Per-plane texture. Empty follows `name`; 'none' means no texture on that plane.
   */
  textures: Record<PlaneName, string>
  /** Where the user's pick is remembered. Namespace it per app. */
  storageKey: string
}

/** A partial override. Setting one plane must not drop the other three. */
export type TextureConfigPatch = Partial<
  Omit<TextureConfig, 'planes' | 'textures'>
> & {
  planes?: Partial<Record<PlaneName, number>>
  textures?: Partial<Record<PlaneName, string>>
}

const NO_PLANE_STRINGS: Record<PlaneName, string> = {
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
const config = reactive<TextureConfig>({
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
  if (typeof document === 'undefined') return

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

/**
 * The texture and the user's pick. Module-level state, so every picker agrees.
 * Each key is stored separately, so adding a plane keeps older saved picks.
 */
export function useTexture() {
  const current = computed(() => config.name)

  /** What each plane wears, resolved: its own texture, or the global one. */
  const perPlane = computed(
    () => Object.fromEntries(
      PLANES.map(plane => [plane, config.textures[plane] || config.name]),
    ) as Record<PlaneName, string>,
  )

  /** Every texture with `none` in front, for the pickers. */
  const options = computed(() => ['none', ...TEXTURES.map(spec => spec.name)])

  /** The plane picker's options: '' follows the global pick, 'none' is no texture. */
  const planeOptions = computed(() => ['', 'none', ...TEXTURES.map(spec => spec.name)])

  function remember() {
    write(`${config.storageKey}.name`, config.name)
    for (const plane of PLANES) {
      write(`${config.storageKey}.plane.${plane}`, config.textures[plane])
    }
  }

  function set(name: string) {
    applyTexture({ name })
    remember()
  }

  /** Empty follows the global pick; 'none' is no texture. */
  function setPlane(plane: PlaneName, name: string) {
    applyTexture({ textures: { [plane]: name } })
    remember()
  }

  /** Restores the stored pick, called by the plugin after app config so a stored choice wins. */
  function restore() {
    const name = read(`${config.storageKey}.name`)
    const textures: Partial<Record<PlaneName, string>> = {}

    for (const plane of PLANES) {
      const stored = read(`${config.storageKey}.plane.${plane}`)
      if (stored !== null) textures[plane] = stored
    }

    applyTexture({ ...(name ? { name } : {}), textures })
  }

  return {
    /* The catalogue, exposed here because a template cannot reach an
       auto-imported const. */
    catalogue: TEXTURES,
    current,
    perPlane,
    options,
    planeOptions,
    planes: PLANES,
    set,
    setPlane,
    restore,
  }
}
