// web/tests/palette.spec.ts

import { describe, expect, it } from 'vitest'
import {
  DEFAULT_PALETTE,
  palette,
  PALETTE_NAMES,
  PALETTES,
  paletteTexture,
} from '../src/theme/palette'
import { s99abTheme } from '../src/theme'

// Contrast and separation checks for every palette the tone engine produces.

const channel = (v: number) => {
  const c = v / 255
  return c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4
}

function luminance(hex: string): number {
  const n = Number.parseInt(hex.slice(1), 16)
  return 0.2126 * channel((n >> 16) & 255)
    + 0.7152 * channel((n >> 8) & 255)
    + 0.0722 * channel(n & 255)
}

function ratio(a: string, b: string): number {
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x) as [number, number]
  return (hi + 0.05) / (lo + 0.05)
}

// Each pair at its required ratio: text 4.5, control borders and filled controls 3.
// `line` separates large planes and only gets a visibility floor; `edge` identifies components.
const CHECKS: Array<[a: string, b: string, min: number]> = [
  ['on-background', 'background', 4.5],
  ['ink2', 'well', 4.5],
  ['ink3', 'chrome', 4.5],
  ['on-accent', 'accent', 4.5],
  ['error', 'well', 4.5],
  ['success', 'well', 4.5],
  ['warning', 'well', 4.5],
  ['info', 'well', 4.5],
  ['edge', 'raised', 3],
  ['accent', 'background', 3],
  ['track', 'well', 3],
  ['line', 'bg', 1.5],
  ['wellLine', 'well', 1.5],
  ['lineSoft', 'chrome', 1.15],
]

const VARIANTS: Array<[label: string, dark: boolean, high: boolean]> = [
  ['light', false, false],
  ['dark', true, false],
  ['light high', false, true],
  ['dark high', true, true],
]

for (const name of PALETTE_NAMES) {
  describe(`palette ${name}`, () => {
    for (const [label, dark, high] of VARIANTS) {
      describe(label, () => {
        const colors = palette({ dark, high, name })

        for (const [a, b, min] of CHECKS) {
          it(`${a} on ${b} clears ${min}`, () => {
            expect(colors[a], `${a} is missing`).toBeDefined()
            expect(colors[b], `${b} is missing`).toBeDefined()
            expect(ratio(colors[a]!, colors[b]!)).toBeGreaterThanOrEqual(min)
          })
        }

        // Two planes that measure the same cannot be told apart.
        it('keeps its surfaces apart', () => {
          expect(ratio(colors.chrome!, colors.bg!)).toBeGreaterThan(1.04)
          expect(ratio(colors.raised!, colors.chrome!)).toBeGreaterThan(1.08)
        })

        it('emits every token as a hex, which is what Vuetify parses', () => {
          for (const [key, value] of Object.entries(colors)) {
            expect(value, `${key} is ${value}`).toMatch(/^#[0-9a-f]{6}$/i)
          }
        })
      })
    }
  })
}

describe('the catalogue', () => {
  it('ships the default it names', () => {
    expect(PALETTE_NAMES).toContain(DEFAULT_PALETTE)
  })

  it('gives every palette a texture, and none of them a heavy one', () => {
    for (const name of PALETTE_NAMES) {
      const texture = paletteTexture(name)
      expect(texture.name, `${name} names no texture`).toBeTruthy()
      // Above 1.4 a texture reads as a printed pattern.
      expect(texture.gain ?? 1).toBeLessThanOrEqual(1.4)
    }
  })

  it('states a distinct label for each, so a picker can list them', () => {
    const labels = PALETTE_NAMES.map(n => PALETTES[n].label)
    expect(new Set(labels).size).toBe(labels.length)
  })

  // An app's accent is used as given at every contrast level.
  it('leaves an app-supplied accent alone', () => {
    for (const high of [false, true]) {
      expect(palette({ dark: true, high, accent: '#ff0000' }).accent).toBe('#ff0000')
    }
  })

  it('restates its own accent for the high-contrast pair', () => {
    for (const name of PALETTE_NAMES) {
      const plain = palette({ dark: true, name })
      const widened = palette({ dark: true, high: true, name })

      expect(widened.accent, name).not.toBe(plain.accent)
      expect(ratio(widened.accent!, widened.bg!), name)
        .toBeGreaterThan(ratio(plain.accent!, plain.bg!))
    }
  })

  // Void states its own grounds, which the shared tone table cannot.
  it('honours a palette that states its own grounds', () => {
    expect(palette({ dark: true, name: 'void' }).bg).toBe('#000000')
  })
})

// -------------------------------------------------------------- chroma ----

// The neutrals' share of the accent's hue, checked across a spread of accents,
// including reds and yellows where a fixed tone shifts most.
const ACCENTS = ['#2358d6', '#b91c1c', '#15803d', '#b45309', '#7e22ce', '#0f766e']

describe('chroma', () => {
  it('is off unless asked for', () => {
    for (const dark of [false, true]) {
      expect(palette({ dark, accent: '#15803d' }).bg).toBe(palette({ dark }).bg)
    }
  })

  it('changes every surface when it is turned up', () => {
    const plain = palette({ dark: true, accent: '#15803d' })
    const woven = palette({ dark: true, accent: '#15803d', chroma: 1 })

    expect(woven.bg).not.toBe(plain.bg)
    expect(woven.chrome).not.toBe(plain.chrome)
    expect(woven.line).not.toBe(plain.line)
  })

  // Without an accent there is nothing to derive from, so no hue is invented.
  it('is ignored without an accent', () => {
    expect(palette({ dark: true, chroma: 1 }).bg).toBe(palette({ dark: true }).bg)
  })

  it('lands between the two ends at a fraction', () => {
    const some = palette({ dark: true, accent: '#15803d', chroma: 0.4 })

    expect(some.bg).not.toBe(palette({ dark: true, accent: '#15803d' }).bg)
    expect(some.bg).not.toBe(palette({ dark: true, accent: '#15803d', chroma: 1 }).bg)
  })

  // Tones are fixed perceptual lightness at any hue, so contrast must hold for every accent.
  for (const accent of ACCENTS) {
    it(`holds every ratio at full chroma for ${accent}`, () => {
      for (const [label, dark, high] of VARIANTS) {
        const colors = palette({ dark, high, accent, chroma: 1 })

        for (const [a, b, min] of CHECKS) {
          // The accent itself is used as given, so it may be quiet on another
          // ground; each palette's own accent is checked above.
          if (a === 'accent' || a === 'on-accent') continue

          expect(ratio(colors[a]!, colors[b]!), `${a}/${b} ${label} ${accent}`)
            .toBeGreaterThanOrEqual(min)
        }
      }
    })

    it(`keeps body text at 7:1 on every surface for ${accent}`, () => {
      for (const dark of [false, true]) {
        const colors = palette({ dark, accent, chroma: 1 })

        for (const surface of ['bg', 'well', 'chrome', 'chrome2', 'raised', 'row']) {
          expect(
            ratio(colors.ink!, colors[surface]!),
            `ink on ${surface} (${dark ? 'dark' : 'light'}, ${accent})`,
          ).toBeGreaterThanOrEqual(7)
        }
      }
    })

    // The surfaces sit in a narrow band at each end; two resolving to one hex are one plane.
    it(`keeps the surfaces distinct for ${accent}`, () => {
      for (const dark of [false, true]) {
        const colors = palette({ dark, accent, chroma: 1 })
        const surfaces = ['well', 'bg', 'chrome', 'chrome2', 'raised'].map(k => colors[k])

        expect(new Set(surfaces).size).toBe(surfaces.length)
      }
    })
  }
})

// ---------------------------------------------------------- status hues ----

// Four distinguishable status hues whatever the accent, so a green accent never
// makes success and info the same colour.
describe('status hues', () => {
  /** Rough hue in degrees. */
  function hueOf(hex: string): number {
    const [r, g, b] = [1, 3, 5].map(i => Number.parseInt(hex.slice(i, i + 2), 16) / 255) as [number, number, number]
    const max = Math.max(r, g, b)
    const min = Math.min(r, g, b)
    if (max === min) return 0

    const d = max - min
    const h = max === r ? ((g - b) / d + (g < b ? 6 : 0)) : max === g ? (b - r) / d + 2 : (r - g) / d + 4
    return h * 60
  }

  /** The shortest way round the circle between two hues. */
  function apart(a: string, b: string): number {
    const d = Math.abs(hueOf(a) - hueOf(b)) % 360
    return d > 180 ? 360 - d : d
  }

  const HUES = ['#22c55e', '#dc2626', '#f59e0b', '#2358d6', '#7c3aed']

  for (const accent of HUES) {
    it(`keeps info clear of success and error at accent ${accent}`, () => {
      for (const dark of [false, true]) {
        for (const chroma of [0, 1]) {
          const p = palette({ dark, accent, chroma })

          expect(apart(p.info!, p.success!), `${accent} ${dark ? 'dark' : 'light'} @${chroma}`)
            .toBeGreaterThan(40)
          expect(apart(p.info!, p.error!), `${accent} ${dark ? 'dark' : 'light'} @${chroma}`)
            .toBeGreaterThan(40)
        }
      }
    })

    // Info is never the accent.
    it(`does not hand info the accent at ${accent}`, () => {
      expect(palette({ dark: true, accent }).info).not.toBe(accent)
      expect(palette({ dark: true, accent, chroma: 1 }).info).not.toBe(accent)
    })
  }

  // Harmonisation rotates a status hue toward the accent by at most 15 degrees.
  // Asserts on the triple: amber is about 15 degrees from red, so `warn` can clamp to the same place.
  it('rotates the status hues toward the accent', () => {
    const blue = palette({ dark: true, accent: '#2358d6', chroma: 1 })
    const red = palette({ dark: true, accent: '#b91c1c', chroma: 1 })

    expect([blue.ok, blue.danger, blue.warn]).not.toEqual([red.ok, red.danger, red.warn])
    expect(blue.ok).not.toBe(red.ok)
  })

  it('leaves them alone at chroma 0', () => {
    expect(palette({ dark: true, accent: '#2358d6' }).ok)
      .toBe(palette({ dark: true, accent: '#b91c1c' }).ok)
  })
})

// ------------------------------------------------------------ lit hues ----

// Graphic partners: an alert icon needs only 3:1, so on light it gets a brighter
// hue than the 4.5:1 text colour.
describe('lit status hues', () => {
  const LIT = [['ok-lit', 'success'], ['danger-lit', 'error'], ['warn-lit', 'warning'], ['info-lit', 'info']] as const

  for (const [lit, text] of LIT) {
    it(`${lit} clears 3:1 on the light ground`, () => {
      const light = palette({ dark: false })
      expect(ratio(light[lit]!, light.well!)).toBeGreaterThanOrEqual(3)
    })

    it(`${lit} survives full chroma`, () => {
      const woven = palette({ dark: false, accent: '#7c3aed', chroma: 1 })
      expect(ratio(woven[lit]!, woven.well!)).toBeGreaterThanOrEqual(3)
    })

    // On light the lit hue is brighter; on high-contrast variants the two are identical.
    it(`${lit} is lighter than the ${text} it partners`, () => {
      expect(luminance(palette({ dark: false })[lit]!))
        .toBeGreaterThan(luminance(palette({ dark: false })[text]!))

      const widened = palette({ dark: false, high: true })
      expect(widened[lit]).toBe(widened[text])
    })
  }
})

// -------------------------------------------------------------- s99abTheme --

/** s99abTheme's `theme` is typed as `ThemeOptions | false`; narrow it once. */
function themes(opts: ReturnType<typeof s99abTheme>) {
  const theme = opts.theme
  if (!theme || typeof theme === 'boolean') throw new Error('no themes')
  return theme.themes!
}

describe('s99abTheme', () => {
  // High contrast is a repaint of these two; see src/theme/index.ts.
  it('registers light and dark and nothing else', () => {
    expect(Object.keys(themes(s99abTheme())).sort()).toEqual(['dark', 'light'])
  })

  it('carries an app accent into both', () => {
    const built = themes(s99abTheme({ accent: '#15803d' }))

    expect(built.light!.colors!.accent).toBe('#15803d')
    expect(built.dark!.colors!.accent).toBe('#15803d')
  })

  it('takes one accent per variant', () => {
    const built = themes(s99abTheme({ accent: { light: '#0f766e', dark: '#5ed6c4' } }))

    expect(built.light!.colors!.accent).toBe('#0f766e')
    expect(built.dark!.colors!.accent).toBe('#5ed6c4')
  })
})
