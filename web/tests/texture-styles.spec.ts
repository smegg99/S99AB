// web/tests/texture-styles.spec.ts

import { readdirSync, readFileSync } from 'node:fs'
import { basename, resolve } from 'node:path'
import { describe, expect, it } from 'vitest'

const sheet = readFileSync(resolve(process.cwd(), 'src/styles/_textures.scss'), 'utf8')

function mapBody(name: string): string {
  const start = sheet.indexOf(`$${name}: (`)
  expect(start, `$${name} is gone or was renamed`).toBeGreaterThan(-1)
  return sheet.slice(start, sheet.indexOf('\n) !default;', start))
}

// From $textures only; $tex-planes has the same shape and would add `ground` and `glass`.
const mapped = [...mapBody('textures').matchAll(/^ {2}'([a-z]+)':\s*\(/gm)]
  .map(m => m[1]!)
  .sort()

const planes = [...mapBody('tex-planes').matchAll(/^ {2}'([a-z]+)':\s*\(/gm)].map(m => m[1]!)

const files = readdirSync(resolve(process.cwd(), 'public/textures'))
  .filter(name => name.endsWith('.svg'))
  .map(name => basename(name, '.svg'))
  .sort()

describe('texture stylesheet', () => {
  // The map and the directory are kept by hand. A missing file draws nothing and looks like `none`.
  it('maps every file and files every mapping', () => {
    expect(mapped).toEqual(files)
  })

  it('gives every entry a tile, a weight and a repeat', () => {
    const body = mapBody('textures')

    for (const name of mapped) {
      const entry = body.match(new RegExp(`'${name}':\\s*\\(([^)]*)\\)`))

      expect(entry, `${name} has no map entry`).not.toBeNull()
      expect(entry![1], `${name} is missing tile`).toMatch(/tile:/)
      expect(entry![1], `${name} is missing weight`).toMatch(/weight:/)
      expect(entry![1], `${name} is missing repeat`).toMatch(/repeat:/)
    }
  })

  // The bar and rail are chrome; the explorer grid is a well.
  it('knows the four planes', () => {
    expect(planes).toEqual(['ground', 'chrome', 'well', 'overlay'])
  })

  // Selection rules use :where() at zero specificity, so a :root default for the
  // same property would beat them and silently remove the mask.
  it('declares no default that would out-specify a selection', () => {
    const base = sheet.match(/^:root \{([\s\S]*?)\n\}/m)
    expect(base, 'the :root block is gone or was renamed').not.toBeNull()

    const declared = [...base![1]!.matchAll(/^ {2}(--s99ab-tex-[a-z-]+):/gm)].map(m => m[1]!)
    const selected = new Set(
      [...sheet.matchAll(/:where\(:root\[data-tex[^\]]*\][^{]*\{([\s\S]*?)\n {2}\}/g)]
        .flatMap(([, body]) => [...body!.matchAll(/(--s99ab-tex-[a-z-]+):/g)].map(m => m[1]!)),
    )

    const clashing = declared.filter(name => selected.has(name))

    expect(
      clashing,
      `read these through a var() fallback instead: ${clashing.join(', ')}`,
    ).toEqual([])
  })

  // Undeclared properties are read with a fallback, or they resolve to nothing.
  it.each([
    ['--s99ab-tex-mask', 'none'],
    ['--s99ab-tex-tile', '0px'],
    ['--s99ab-tex-repeat', 'repeat'],
    ['--s99ab-tex-weight', '1'],
  ])('reads %s with a fallback', (name, fallback) => {
    expect(sheet).toContain(`var(${name}, ${fallback})`)
  })

  // An SVG image has no intrinsic size, so a one-value mask-size stretches the second dimension.
  it('states both dimensions of the mask size', () => {
    const size = sheet.match(/--s99ab-tex-size:\s*([^;]+);/)

    expect(size).not.toBeNull()
    expect(size![1]!.match(/calc\(/g)?.length).toBe(2)
  })

  // Wails runs WebKitGTK, where the unprefixed properties are not reliable.
  it.each(['mask-image', 'mask-size', 'mask-repeat'])('prefixes %s', (prop) => {
    expect(sheet).toMatch(new RegExp(`-webkit-${prop}:`))
    expect(sheet).toMatch(new RegExp(`(?<!-)\\b${prop}:`))
  })

  // Texture reduces separation, so high contrast turns it off. Keyed on the root
  // attribute useAppearance writes, since contrast repaints the two themes.
  it('suppresses itself at high contrast and in print', () => {
    expect(sheet).toMatch(/:root\[data-contrast='high'\]/)
    expect(sheet).toMatch(/@media print/)
  })

  // Unlayered `position: relative` would beat Vuetify and pull self-placed
  // surfaces such as select menus into the document flow.
  it('leaves the surfaces that place themselves alone', () => {
    const body = mapBody('tex-planes')

    expect(body).toMatch(/'ground': \(placed: \('\.s99ab-backdrop'\)\)/)
    expect(body).toMatch(/placed: \('\.s99ab-glass'\)/)
    expect(body).toMatch(/placed: \('\.v-menu > \.v-overlay__content'\)/)
    expect(sheet).toMatch(/@include tex-layer\(\$plane, null\);/)
  })

  // The texture is a positioned ::before at z-index 0, so content children are
  // lifted or the texture paints over the text.
  it('lifts the children of every plane that holds any', () => {
    const lifted = sheet.match(/([^{}]+)\{\n {2}position: relative;\n\}/g)?.join(' ') ?? ''

    for (const plane of [
      '.s99ab-slab',
      '.panel__head',
      '.panel__foot',
      '.table__top',
      '.s99ab-explorer__bar',
      '.v-data-table-footer',
      '.v-toolbar__content',
      '.s99ab-tile',
      '.v-overlay .v-card',
    ]) {
      expect(lifted, `${plane} does not lift its children`).toContain(`${plane} > *`)
    }
  })
})

describe('per-plane textures', () => {
  // A ground and a content well can wear different textures.
  it.each(['ground', 'chrome', 'well', 'overlay'])(
    'lets the %s plane name its own texture',
    (plane) => {
      expect(sheet).toContain(`:where(:root[data-tex-#{$plane}='#{$name}'])`)
      expect(sheet).toContain(`--s99ab-tex-#{$plane}-mask`)
    // The mixin reads this plane's value before the global one.
      expect(sheet).toContain(
        `var(--s99ab-tex-#{$plane}-mask, var(--s99ab-tex-mask, none))`,
      )
      expect(planes).toContain(plane)
    },
  )

  // A component class overrides a plane's texture through a separate
  // --s99ab-tex-local-* set, which the mixin reads first.
  it.each(['mask', 'tile', 'weight', 'repeat'])(
    'reads the local %s before the plane and the global one',
    (prop) => {
      const fallbacks: Record<string, string> = {
        mask: 'none',
        tile: '0px',
        weight: '1',
        repeat: 'repeat',
      }

      expect(sheet).toContain(
        `var(--s99ab-tex-local-${prop}, var(--s99ab-tex-#{$plane}-${prop}, `
        + `var(--s99ab-tex-${prop}, ${fallbacks[prop]})))`,
      )
    },
  )

  it('writes the local set from the component class and nowhere else', () => {
    expect(sheet).toMatch(/\.s99ab-tex--#\{\$name\} \{\n {4}--s99ab-tex-local-mask/)

    // Only the class block may set them.
    const writers = [...sheet.matchAll(/^ {4}--s99ab-tex-local-[a-z]+:/gm)]
    expect(writers).toHaveLength(4)
  })

  // A plane has a texture and a strength; no per-plane scale or ink.
  it('gives a plane no scale or ink of its own', () => {
    expect(sheet).not.toContain('-scale, var(--s99ab-tex-scale)')
    expect(sheet).not.toContain('-ink, var(--s99ab-tex-ink)')
    expect(sheet).toContain('background: var(--s99ab-tex-ink);')
  })

  // A custom property holding var() is substituted on :root, so the values are
  // restated per plane.
  it('restates the literal values per plane rather than pointing at the global set', () => {
    const perPlane = sheet.match(
      /:where\(:root\[data-tex-#\{\$plane\}[\s\S]*?\n {4}\}/,
    )

    expect(perPlane).not.toBeNull()
    expect(perPlane![0]).toContain('url(')
    expect(perPlane![0]).not.toContain('var(--s99ab-tex-mask)')
  })
})

describe('port mode', () => {
  it('is a class, not a default', () => {
    expect(sheet).toMatch(/\.s99ab-port\b/)
  })

  it('goes translucent over the ground and frosts it', () => {
    const block = sheet.match(/^\.s99ab-port \{([\s\S]*?)\n\}/m)

    expect(block).not.toBeNull()
    expect(block![1]).toMatch(/backdrop-filter/)
    expect(block![1]).toMatch(/--s99ab-tex-port/)
  })

  // A moving ground under body text costs legibility, so high contrast makes it opaque.
  it('is opaque again at high contrast', () => {
    expect(sheet).toMatch(/:root\[data-contrast='high'\] \.s99ab-port/)
  })
})

// Nothing in the texture system animates; motion comes from the shader ground.
describe('textures do not move', () => {
  it('declares no keyframes', () => {
    expect(sheet).not.toMatch(/@keyframes/)
  })

  it('sets no animation', () => {
    expect(sheet).not.toMatch(/\banimation(-name)?:/)
  })

  it('has no motion left to select', () => {
    expect(sheet).not.toMatch(/data-tex-motion/)
  })
})
