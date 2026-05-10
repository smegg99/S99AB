// web/tests/tokens.spec.ts

import { readdirSync, readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'
import { useExplorerConfig } from '../src/composables/explorer/useExplorerConfig'

// Resolved from the project root, since import.meta.url is an http URL under happy-dom.
const dir = resolve(process.cwd(), 'src/styles')
const read = (name: string) => readFileSync(resolve(dir, name), 'utf8')

const config = read('_config.scss')
const root = read('_root.scss')

function declared(name: string): string | undefined {
  const match = config.match(new RegExp(`^\\$${name}:\\s*([^;]+?)\\s*!default;`, 'm'))
  return match?.[1]?.trim()
}

// ------------------------------------------------------------- mirrors ----

// Values stated in both TypeScript and Sass. UiExplorer writes the tile grid
// minimum at runtime, and the stylesheet needs it to lay the grid out first.
const MIRRORED: Array<[string, string]> = [
  ['tile-min', `${useExplorerConfig().tileMin}px`],
  // UiExplorer writes the aspect at runtime too, per instance.
  ['tile-aspect', `${useExplorerConfig().tile.aspect}`],
]

describe('theme tokens', () => {
  it.each(MIRRORED)('$%s matches its TypeScript constant', (name, value) => {
    expect(declared(name)).toBe(value)
  })

  // A variable renamed in Sass would otherwise compare undefined with undefined.
  it('declares every mirrored variable', () => {
    for (const [name] of MIRRORED) {
      expect(declared(name), `$${name} is missing from _config.scss`).toBeDefined()
    }
  })
})

// -------------------------------------------------------------- parity ----

// Each _config.scss knob is emitted as a property in _root.scss, and every
// property there has a knob.
const BUILD_TIME_ONLY = new Set([
  // A map, looped by _explorer.scss; a custom property cannot hold one.
  'folder-accents',

  // A url() prefix, resolved at compile time since CSS cannot concatenate into url().
  'tex-base',
])

const RUNTIME_ONLY = new Set([
  // Written at runtime; declared in _root.scss as a starting value for _motion.scss.
  'motion-travel',
  'motion-dir',
])

function knobs(): string[] {
  return [...config.matchAll(/^\$([a-z0-9-]+):[^;]*!default;/gm)].map(m => m[1]!)
}

function properties(): string[] {
  return [...root.matchAll(/^\s*--s99ab-([a-z0-9-]+):/gm)].map(m => m[1]!)
}

describe('config and root', () => {
  it('emits a custom property for every knob', () => {
    const emitted = new Set(properties())
    const missing = knobs().filter(n => !BUILD_TIME_ONLY.has(n) && !emitted.has(n))

    expect(missing, `add --s99ab-<name> to _root.scss: ${missing.join(', ')}`).toEqual([])
  })

  it('declares no property without a knob behind it', () => {
    const known = new Set(knobs())
    const extra = properties().filter(n => !RUNTIME_ONLY.has(n) && !known.has(n))

    expect(extra, `add $<name> to _config.scss: ${extra.join(', ')}`).toEqual([])
  })

  it('emits each property from the knob of the same name', () => {
    for (const name of properties()) {
      if (RUNTIME_ONLY.has(name)) continue
      expect(root, `--s99ab-${name} should interpolate $${name}`)
        .toContain(`--s99ab-${name}: #{$${name}};`)
    }
  })

  // Only the emitting partial and the map-looping partials read Sass variables,
  // so every other value stays retunable at runtime.
  it('keeps Sass variables out of the other partials', () => {
    // _textures.scss loops the catalogue map and needs $tex-base for url().
    const allowed = new Set([
      '_config.scss',
      '_root.scss',
      '_explorer.scss',
      '_textures.scss',
    ])
    const offenders: string[] = []

    for (const name of readdirSync(dir)) {
      if (!name.endsWith('.scss') || allowed.has(name)) continue
      if (/^@use 'config'/m.test(read(name))) offenders.push(name)
    }

    expect(offenders, 'read the custom property instead').toEqual([])
  })
})
