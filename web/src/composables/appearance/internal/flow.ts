// web/src/composables/appearance/internal/flow.ts

import { reactive } from 'vue'
import { inBrowser } from '../../../browser/env'

export const config = reactive<GroundConfig>({
  kind: 'flow',
  maxInstances: 3,
  resolution: 0.8,
  licenseKey: '',

  speed: 3,
  horizontalPressure: 3,
  verticalPressure: 4,
  waveFrequencyX: 2,
  waveFrequencyY: 3,
  waveAmplitude: 4,
  shadows: 10,
  highlights: 4,
  colorBlending: 3,
  colorSaturation: 1,
  colorBrightness: 1,
  wireframe: false,

  colors: [],

  // Dark takes a gentler shape on its near-black ground.
  dark: { shadows: 6, highlights: 1, colorBrightness: 0.8, colorSaturation: 2 },
})

/** Called by the layer's Nuxt plugin with the app's s99ab.ground config. */
export function configureGround(patch: Partial<GroundConfig>) {
  // Merge `dark` separately; spreading would replace the whole map.
  const { dark, ...rest } = patch

  Object.assign(config, rest)
  if (dark) Object.assign(config.dark, dark)
}

/** The shader shape for one variant, with dark overrides applied over the base. */
export function groundShape(dark: boolean): GroundShape {
  const { kind, maxInstances, resolution, licenseKey, colors, dark: overrides, loader, ...shape } = config

  return dark ? { ...shape, ...overrides } : shape
}

/** The configured ground, without a computed. */
export function groundConfig(): GroundConfig {
  return config
}

/**
 * Puts the kind on the document as `data-ground`, which the stylesheet reads to
 * set the washes' strength. Called by the plugin and on runtime changes.
 */
export function applyGround() {
  if (!inBrowser()) return
  document.documentElement.setAttribute('data-ground', config.kind)
}

let live = 0

export function liveInstances(): number {
  return live
}

/**
 * Takes a slot, or refuses. `priority` (the ground) is admitted over the cap
 * without evicting a running canvas.
 */
export function acquireSlot(priority: boolean): boolean {
  if (!priority && live >= config.maxInstances) return false
  live += 1
  return true
}

export function releaseSlot() {
  // Clamped, so a double unmount cannot free extra slots.
  if (live > 0) live -= 1
}

/** Whether WebGL is available at all. */
export function supportsWebgl(): boolean {
  if (!inBrowser()) return false

  try {
    // A separate probe canvas: testing takes a context, and a canvas with a
    // WebGL context cannot give a 2D one.
    const probe = document.createElement('canvas')
    return Boolean(probe.getContext('webgl2') || probe.getContext('webgl'))
  }
  catch {
    return false
  }
}

/**
 * The gradient stops from theme tokens, in shader order: ground, three casts,
 * then one stop darker than the ground. A missing token falls back to the ground.
 */
export function flowStops(colors: Record<string, string>, dark: boolean): string[] {
  // App-named stops override the palette; see GroundConfig.colors.
  if (config.colors.length) return [...config.colors]

  const ground = colors.bg ?? colors.background ?? (dark ? '#111317' : '#edf0f5')

  return [
    ground,
    colors.accent ?? ground,
    colors.warning ?? ground,
    colors.accent ?? ground,
    colors.sunk ?? ground,
  ]
}

let cached: NeatConstructor | null = null

let warned = false

/**
 * Loads the library once, or answers null. Warns when the ground is on and the
 * app supplied no loader.
 */
export async function loadNeat(): Promise<NeatConstructor | null> {
  if (cached) return cached

  const load = config.loader
  if (!load) {
    if (!warned && typeof console !== 'undefined') {
      warned = true
      console.warn(
        '[s99ab] flow is enabled but s99ab.ground.loader is not set, so the '
        + 'WebGL ground cannot be loaded and the CSS backdrop is all that will '
        + 'show. Install @firecms/neat and pass '
        + '`loader: () => import(\'@firecms/neat\')`.',
      )
    }
    return null
  }

  try {
    // The one cast; see GroundConfig.loader.
    const mod = await load() as { NeatGradient?: NeatConstructor } | undefined
    cached = mod?.NeatGradient ?? null
    return cached
  }
  catch {
    // A missing or broken dependency: the caller stays on the CSS still.
    return null
  }
}

// web/src/composables/appearance/useFlow.ts

// The WebGL ground. Browsers cap live WebGL contexts and kill the oldest, so
// canvases share a capped slot registry. @firecms/neat is an optional peer.

/**
 * @firecms/neat options, named as neat names them so a gradient from
 * neat.firecms.co pastes in as-is.
 */
export interface GroundShape {
  speed: number
  horizontalPressure: number
  verticalPressure: number
  waveFrequencyX: number
  waveFrequencyY: number
  waveAmplitude: number
  shadows: number
  highlights: number
  colorBlending: number
  /** Multiplies the saturation the theme's own stops already carry. */
  colorSaturation: number
  colorBrightness: number
  wireframe: boolean
}

/**
 * What the app sits on. `flow` is the WebGL gradient over dimmed washes; `wash`
 * is the CSS washes at full strength, and the fallback when WebGL or motion is
 * unavailable; `none` is the flat background token.
 */
export type GroundKind = 'flow' | 'wash' | 'none'

export interface GroundConfig extends GroundShape {
  kind: GroundKind
  /** Live canvases allowed at once, the ground included. */
  maxInstances: number
  /** Fraction of device pixels the shader renders at. */
  resolution: number
  /**
   * Gradient colours overriding the theme-derived stops. Empty follows the
   * palette (`accent`, `warning`, `sunk`, `bg`).
   */
  colors: string[]
  /** Shape overrides applied in the dark variant. */
  dark: Partial<GroundShape>
  /**
   * A @firecms/neat licence key for 1.x, which draws a watermark in the canvas
   * without one. 0.x needs none.
   */
  licenseKey: string
  /**
   * Loads @firecms/neat, e.g. `() => import('@firecms/neat')`. Supplied by the
   * app, since the layer cannot import an optional peer. `unknown`, cast once in loadNeat.
   */
  loader?: () => Promise<unknown>
}

export interface NeatInstance {
  destroy: () => void
  yOffset?: number
}

export type NeatConstructor = new (options: Record<string, unknown>) => NeatInstance
