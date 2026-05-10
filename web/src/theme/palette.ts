// web/src/theme/palette.ts

/**
 * Every colour the layer has, from one seed, built in HCT so each tone is a
 * fixed perceptual lightness and contrast holds for any accent. `chroma` sets
 * how much of the accent's hue the neutrals carry: 0 is the palette's own greys.
 */

import { argbFromHex, Hct, hexFromArgb } from '@material/material-color-utilities'
import type { TextureConfigPatch } from '../composables/appearance/useTexture'

export type Palette = Record<string, string>

/** How light each token is. */
interface Tones {
  bg: number
  chrome: number
  chrome2: number
  raised: number
  sunk: number
  well: number
  row: number
  wellLine: number
  line: number
  lineSoft: number
  edge: number
  track: number
  knob: number
  ink: number
  ink2: number
  ink3: number
  neutral: number
  accent: number
  status: number
  /** The status hues as graphics; see `lit` in STATUS. Unused by the high tables. */
  statusLit: number
}

/*
  Dark surfaces are bunched in the bottom fifth of the range. Inks and lines sit
  higher than a mirror of LIGHT would put them, since dark grounds swallow hairlines.
*/
const DARK: Tones = {
  bg: 6,
  well: 4,
  sunk: 8,
  row: 9,
  chrome: 11,
  chrome2: 15,
  raised: 22,
  wellLine: 26,
  lineSoft: 28,
  line: 36,
  edge: 63,
  track: 55,
  knob: 86,
  ink3: 66,
  ink2: 83,
  ink: 93,
  neutral: 74,
  accent: 80,
  status: 68,
  statusLit: 76,
}

const LIGHT: Tones = {
  bg: 95,
  well: 100,
  sunk: 82,
  row: 97,
  chrome: 93,
  chrome2: 89,
  raised: 99,
  wellLine: 80,
  lineSoft: 76,
  line: 62,
  edge: 45,
  track: 58,
  knob: 100,
  ink3: 42,
  ink2: 30,
  ink: 10,
  neutral: 40,
  accent: 40,
  status: 41,
  statusLit: 54,
}

/*
  Every separation widened: inks to the ends of the range, hairlines up to
  control borders, surfaces moved least so the planes stay distinct.
  `statusLit` equals `status`.
*/
const DARK_HIGH: Tones = {
  ...DARK,
  // Pure black here and pure white in LIGHT_HIGH; the ordinary tables stop short.
  bg: 0,
  well: 0,
  chrome: 9,
  chrome2: 14,
  raised: 24,
  wellLine: 34,
  lineSoft: 34,
  line: 46,
  edge: 68,
  track: 58,
  knob: 100,
  ink3: 78,
  ink2: 90,
  ink: 100,
  neutral: 80,
  accent: 90,
  status: 76,
}

const LIGHT_HIGH: Tones = {
  ...LIGHT,
  bg: 100,
  well: 100,
  sunk: 76,
  chrome: 94,
  chrome2: 90,
  wellLine: 58,
  lineSoft: 58,
  line: 40,
  edge: 24,
  track: 40,
  ink3: 24,
  ink2: 14,
  ink: 0,
  neutral: 24,
  accent: 30,
  status: 32,
}

/** How much more chroma a hairline carries than its surface, so it reads as an edge. */
const LINE_LIFT = 1.9

/** The neutrals' chroma at `chroma: 1`. */
const HARMONISED_CHROMA = 8

/** How far a status hue may rotate toward the accent, in degrees; 15 keeps green reading as green. */
const HARMONISE_ARC = 15

/**
 * The four status hues: a hue and the chroma each is recognisable at. Text is
 * held to 4.5:1; `lit` is the graphic chroma, held to 3:1, for icons.
 */
const STATUS = {
  ok: { hue: 155, chroma: 50, lit: 65 },
  danger: { hue: 26, chroma: 70, lit: 78 },
  warn: { hue: 72, chroma: 42, lit: 58 },
  info: { hue: 259, chroma: 50, lit: 60 },
} as const

type StatusName = keyof typeof STATUS

/** One named look: a hue for the neutrals, a seed for the accent, and its stock. */
export interface PaletteSpec {
  /** One line, for the picker. */
  label: string
  /** The accent. Both variants and the high-contrast pair are tones of it. */
  accent: string
  /** The neutrals' hue in degrees, and their chroma at `chroma: 0`. */
  neutral: { hue: number, chroma: number }
  /** The accent's tone per variant, where the shared tables do not suit. Bone's accent is the ink. */
  accentTone?: { light: number, dark: number }
  /** Tone deltas over the shared tables, for a look defined by a specific ground (void is true black). */
  tones?: { light?: Partial<Tones>, dark?: Partial<Tones> }
  /** The palette's default texture. */
  texture: TextureConfigPatch
}

export const PALETTES = {
  // Warm graphite with a faint violet bias. The default.
  graphite: {
    label: 'Graphite - warm neutral, teal accent',
    accent: '#0d7a6d',
    neutral: { hue: 300, chroma: 6.5 },
    // Grain: no geometry, so it stays neutral.
    texture: { name: 'grain', gain: 1 },
  },

  // Black and white with one hot accent. Grounds are stated to get true black.
  void: {
    label: 'Void - true black, one vermilion',
    accent: '#cf2f00',
    neutral: { hue: 279, chroma: 2 },
    tones: {
      dark: { bg: 0, well: 2, sunk: 0 },
      light: { bg: 100 },
    },
    // Fine film grain, below 1 so it does not turn to noise on true black.
    texture: { name: 'static', gain: 0.8 },
  },

  // Old rose on plum-black: hued greys and a dusty rose accent, like two-ink print.
  rose: {
    label: 'Rose - plum-black, dusty rose',
    accent: '#a5305a',
    neutral: { hue: 338, chroma: 6 },
    // Paper fibre.
    texture: { name: 'paper', gain: 1.1 },
  },

  // Paper and ink, no hue. The accent is the ink itself, hence `accentTone`.
  bone: {
    label: 'Bone - warm paper, ink for an accent',
    accent: '#191710',
    neutral: { hue: 95, chroma: 3.4 },
    accentTone: { light: 10, dark: 93 },
    // The heaviest gain of the four, so the paper shows.
    texture: { name: 'paper', gain: 1.3 },
  },
} as const satisfies Record<string, PaletteSpec>

export type PaletteName = keyof typeof PALETTES

export const DEFAULT_PALETTE: PaletteName = 'graphite'

export const PALETTE_NAMES = Object.keys(PALETTES) as PaletteName[]

/** The default palette's accent. */
export const DEFAULT_ACCENT = PALETTES[DEFAULT_PALETTE].accent

/** The texture a palette was drawn with. An app's own `s99ab.texture` overrides it. */
export function paletteTexture(name: PaletteName = DEFAULT_PALETTE): TextureConfigPatch {
  return { ...PALETTES[name].texture }
}

// ------------------------------------------------------------------ mixing --

const shade = (hue: number, chroma: number, tone: number) =>
  hexFromArgb(Hct.from(hue, chroma, tone).toInt())

const clampTone = (tone: number) => Math.min(Math.max(tone, 0), 100)

/** `t` of the way from `a` to `b` around the shorter side of the circle. */
function lerpHue(a: number, b: number, t: number): number {
  const d = ((b - a + 540) % 360) - 180
  return (a + d * t + 360) % 360
}

/** Toward the accent, by at most HARMONISE_ARC and only as far as `t` asks. */
function toward(hue: number, accent: number, t: number): number {
  const d = ((accent - hue + 540) % 360) - 180
  const arc = Math.sign(d) * Math.min(Math.abs(d), HARMONISE_ARC * t)
  return (hue + arc + 360) % 360
}

/**
 * Whether text on this colour should be light or dark: Rec. 709 luma against
 * 0.55. Only used for an app-supplied accent.
 */
function inkOn(hex: string): string {
  const h = hex.replace('#', '')
  const full = h.length === 3 ? h.split('').map(c => c + c).join('') : h
  const n = Number.parseInt(full, 16)
  const luma
    = (0.2126 * ((n >> 16) & 255) + 0.7152 * ((n >> 8) & 255) + 0.0722 * (n & 255)) / 255

  return luma > 0.55 ? '#0d1017' : '#ffffff'
}

// ---------------------------------------------------------------- building --

export interface PaletteOptions {
  dark: boolean
  /** Every separation widened. */
  high?: boolean
  /** Defaults to graphite. */
  name?: PaletteName
  /** Overrides the palette's accent, used as given at every contrast level. */
  accent?: string
  /** How much of the accent's hue the neutrals carry, 0 to 1. Needs `accent` to change anything. */
  chroma?: number
}

function tonesFor(spec: PaletteSpec, dark: boolean, high: boolean): Tones {
  const base = high ? (dark ? DARK_HIGH : LIGHT_HIGH) : dark ? DARK : LIGHT
  const own = dark ? spec.tones?.dark : spec.tones?.light

  return own ? { ...base, ...own } : base
}

/**
 * Builds a full palette, also mapped onto Vuetify's names so its components use
 * the same colours. Hex only, since Vuetify generates --v-theme-* from hex.
 */
export function palette(opts: PaletteOptions): Palette {
  const { dark, high = false, accent: given, chroma = 0 } = opts
  // Widened from the `as const` literal, which lacks the optional fields.
  const spec: PaletteSpec = PALETTES[opts.name ?? DEFAULT_PALETTE]
  const t = tonesFor(spec, dark, high)

  const seed = Hct.fromInt(argbFromHex(given ?? spec.accent))
  const weave = given ? Math.min(Math.max(chroma, 0), 1) : 0

  // The neutrals' hue, pulled toward the accent by `chroma`.
  const nHue = lerpHue(spec.neutral.hue, seed.hue, weave)
  const nChroma = spec.neutral.chroma + (HARMONISED_CHROMA - spec.neutral.chroma) * weave

  const n = (tone: number) => shade(nHue, nChroma, tone)
  /** A hairline tone. See LINE_LIFT. */
  const v = (tone: number) => shade(nHue, nChroma * LINE_LIFT, tone)
  // A status hue, rotated toward the accent by at most HARMONISE_ARC. At high
  // contrast the graphic pair equals the text pair.
  const s = (name: StatusName, lit: boolean) => {
    const loud = lit && !high
    return shade(
      toward(STATUS[name].hue, seed.hue, weave),
      loud ? STATUS[name].lit : STATUS[name].chroma,
      loud ? t.statusLit : t.status,
    )
  }

  // The accent and its ink. An app's accent is used as given; a palette's own is
  // restated per contrast mode, since a vivid hue on black fails contrast.
  const ownTone = spec.accentTone
    ? high
      ? clampTone(spec.accentTone[dark ? 'dark' : 'light'] + (dark ? 7 : -7))
      : spec.accentTone[dark ? 'dark' : 'light']
    : t.accent

  const hue = given ?? shade(seed.hue, seed.chroma, ownTone)
  const onHue = given ? inkOn(given) : shade(seed.hue, seed.chroma, ownTone >= 60 ? 20 : 100)

  return {
    'bg': n(t.bg),
    'chrome': n(t.chrome),
    'chrome2': n(t.chrome2),
    'raised': n(t.raised),
    'sunk': n(t.sunk),
    'well': n(t.well),
    'row': n(t.row),
    'knob': n(t.knob),

    'wellLine': v(t.wellLine),
    'line': v(t.line),
    'lineSoft': v(t.lineSoft),
    'edge': v(t.edge),
    'track': v(t.track),
    'neutral': v(t.neutral),

    'ink': n(t.ink),
    'ink2': n(t.ink2),
    'ink3': n(t.ink3),

    'ok': s('ok', false),
    'danger': s('danger', false),
    'warn': s('warn', false),
    'info': s('info', false),

    'accent': hue,

    'background': n(t.bg),
    'surface': n(t.chrome),
    'surface-light': n(t.chrome2),

    // `surface-bright` is the switch thumb, `surface-variant` every inactive
    // track. Both get their own tones, lighter than the ground, so a dark switch stays visible.
    'surface-bright': n(t.knob),
    'on-surface-bright': dark ? n(t.bg) : n(t.ink),
    'surface-variant': v(t.track),
    'on-surface-variant': n(t.ink2),

    'on-background': n(t.ink),
    'on-surface': n(t.ink),

    // primary is ink; a button opts into the accent with color="accent".
    'primary': n(t.ink2),
    'on-primary': dark ? n(t.bg) : n(t.well),
    'secondary': n(t.ink3),
    'on-secondary': dark ? n(t.bg) : n(t.well),

    'on-accent': onHue,
    'error': s('danger', false),
    'on-error': dark ? n(t.bg) : n(t.well),
    'success': s('ok', false),
    'on-success': dark ? n(t.bg) : n(t.well),
    'warning': s('warn', false),
    'on-warning': dark ? n(t.bg) : n(t.well),
    // info has its own hue, so it never matches success under a green accent.
    'on-info': dark ? n(t.bg) : n(t.well),

    // The graphic partners; see `lit` in STATUS.
    'ok-lit': s('ok', true),
    'danger-lit': s('danger', true),
    'warn-lit': s('warn', true),
    'info-lit': s('info', true),
  }
}
