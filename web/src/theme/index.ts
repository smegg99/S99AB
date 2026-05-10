// web/src/theme/index.ts

import { reactive } from 'vue'
import type { ThemeDefinition, VuetifyOptions } from 'vuetify'
import type { Palette, PaletteName } from './palette'
import { palette } from './palette'

export {
  DEFAULT_ACCENT,
  DEFAULT_PALETTE,
  palette,
  PALETTE_NAMES,
  PALETTES,
  paletteTexture,
} from './palette'
export type { Palette, PaletteName, PaletteOptions, PaletteSpec } from './palette'

/** Dialog widths by size, here so an app can retune them. `full` is a viewport share. */
export const DIALOG_WIDTHS = {
  sm: 420,
  md: 640,
  lg: 960,
  full: '95vw',
} as const

/**
 * Component defaults: flat, bordered, no elevation. No `rounded`, since its
 * `!important` class would beat the radius in styles/_config.scss, and no
 * `color`, so a control opts into the accent.
 */
export const DEFAULTS: VuetifyOptions['defaults'] = {
  // No ripple: it costs a compositing layer per interaction in WebKitGTK, and
  // controls have their own hover and pressed faces.
  global: { ripple: false },
  VBtn: { variant: 'flat', elevation: 0 },
  VCard: { flat: true, border: true, elevation: 0 },
  VSheet: { elevation: 0 },
  // No `label`: a chip keeps the pill shape so tags do not look like disabled buttons.
  VChip: { variant: 'tonal', size: 'small' },
  // No `border`: the layer uses no leading accent stripe anywhere.
  VAlert: { variant: 'tonal' },

  // No `border`: Vuetify draws it in currentColor, and the bar and rail draw
  // their own single edge.
  VAppBar: { flat: true, elevation: 0, border: false },
  VToolbar: { flat: true, elevation: 0 },
  VNavigationDrawer: { flat: true, border: false },
  VFooter: { elevation: 0 },

  // No `hideDetails: 'auto'`: reserving the message row keeps a form from
  // shifting when a field turns invalid. Strip controls use `hide-details`.
  VTextField: { variant: 'outlined', density: 'compact' },
  VTextarea: { variant: 'outlined', density: 'compact' },
  VSelect: { variant: 'outlined', density: 'compact' },
  VAutocomplete: { variant: 'outlined', density: 'compact' },
  VCombobox: { variant: 'outlined', density: 'compact' },
  VFileInput: { variant: 'outlined', density: 'compact' },
  VNumberInput: { variant: 'outlined', density: 'compact' },
  // Selection controls default to `color: accent`, since their colour is their
  // on-state. No `inset` on the switch, which towers over a 36px control.
  VCheckbox: { color: 'accent', density: 'comfortable', hideDetails: 'auto' },
  VSwitch: { color: 'accent', density: 'comfortable', hideDetails: 'auto' },
  VRadioGroup: { color: 'accent', density: 'comfortable', hideDetails: 'auto' },
  VSlider: { color: 'accent', density: 'comfortable', hideDetails: 'auto' },

  VList: { density: 'compact' },
  VTable: { density: 'comfortable' },
  VDataTable: { density: 'comfortable', hover: true },
  VDataTableServer: { density: 'comfortable', hover: true },
  VExpansionPanels: { variant: 'accordion', elevation: 0 },

  VDialog: { scrollable: true },
  VTooltip: { location: 'bottom' },
  VMenu: { location: 'bottom' },
  VProgressLinear: { height: 2, rounded: false },
}

export interface ThemeOptions {
  /**
   * The named look, `graphite` by default; see src/theme/palette.ts. Its texture
   * is applied by the plugin from `s99ab.palette`, or via paletteTexture(name).
   */
  palette?: PaletteName
  /** Overrides the accent in both variants. One value, or one per variant. */
  accent?: string | { light: string, dark: string }
  /**
   * How much of the accent's hue the neutrals carry, 0 to 1. 0 keeps the
   * layer's greys; 1 derives every surface, hairline and ink from the accent.
   * Needs `accent`.
   */
  chroma?: number
  defaultTheme?: 'light' | 'dark'
}

/**
 * The options both themes were last painted from, kept for repainting on a
 * contrast or accent change. The only copy: useAppearance reads `high` here.
 */
const current = reactive<ThemeOptions & { high: boolean }>({ high: false })

function accentFor(
  dark: boolean,
  accent: ThemeOptions['accent'],
): string | undefined {
  if (!accent) return undefined
  return typeof accent === 'string' ? accent : dark ? accent.dark : accent.light
}

function variant(dark: boolean, opts: ThemeOptions, high: boolean): ThemeDefinition {
  const colors = palette({
    dark,
    high,
    name: opts.palette,
    accent: accentFor(dark, opts.accent),
    chroma: opts.chroma,
  })

  return {
    dark,
    colors,
    variables: {
      // The palette is already tuned for contrast, so Vuetify's dimming is off.
      'border-color': colors.line!,
      'border-opacity': 1,
      'high-emphasis-opacity': 1,
      'medium-emphasis-opacity': 1,
      'disabled-opacity': 0.42,
      // Vuetify's 0.32 barely dims a pale page.
      'overlay-opacity': dark ? 0.6 : 0.45,
      // Hover wash; Vuetify's flat 0.04 is invisible on dark. Stronger at high contrast.
      'hover-opacity': high ? (dark ? 0.14 : 0.1) : dark ? 0.07 : 0.05,
    },
  }
}

/** The two themes s99abTheme registers, as Vuetify knows them. */
export type ThemeName = 'light' | 'dark'

/** The part of a Vuetify theme entry that repainting needs. Loose, to stay assignable to Vuetify's `Colors`. */
export interface WritableTheme {
  colors: Record<string, unknown>
  variables: Record<string, unknown>
}

/**
 * The Vuetify theme for an app on this layer: two themes, light and dark. High
 * contrast repaints them, since Vuetify computes many colours in JS.
 *
 * ```ts
 * createVuetify({ components, directives, ...s99abTheme() })
 * ```
 */
export function s99abTheme(opts: ThemeOptions = {}): VuetifyOptions {
  Object.assign(current, opts, { high: false })

  return {
    theme: {
      defaultTheme: opts.defaultTheme ?? 'dark',
      themes: {
        light: variant(false, opts, false),
        dark: variant(true, opts, false),
      },
    },
    defaults: DEFAULTS,
  }
}

/**
 * What a variant would be painted as, without painting it. A cover transition
 * needs the incoming ground before the change lands.
 */
export function previewColors(dark: boolean, high = current.high): Palette {
  return variant(dark, current, high).colors as Palette
}

/**
 * Repaints both themes, merging the patch over the last options. `accent:
 * undefined` restores the palette's own. Vuetify derives colours in JS, so a
 * custom property alone cannot change the accent.
 */
export function rebuildThemes(
  themes: Record<string, WritableTheme>,
  patch: Partial<ThemeOptions & { high: boolean }> = {},
) {
  Object.assign(current, patch)

  for (const name of ['light', 'dark'] as const) {
    const target = themes[name]
    if (!target) continue

    const next = variant(name === 'dark', current, current.high)
    Object.assign(target.colors, next.colors)
    Object.assign(target.variables, next.variables)
  }
}

/** What both themes were last painted from. */
export function themeState(): Readonly<ThemeOptions & { high: boolean }> {
  return current
}
