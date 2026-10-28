// web/src/composables/appearance/useTexture.ts

import { computed } from 'vue'
import { TEXTURES, PLANES, config, applyTexture, read, write } from './internal/texture'

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

/** The kinds of surface a texture can be assigned to. See $tex-planes. */
export type PlaneName = 'ground' | 'chrome' | 'well' | 'overlay'

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
