// web/tests/texture.spec.ts

import { readdirSync, readFileSync } from 'node:fs'
import { basename, resolve } from 'node:path'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { useTexture } from '../src/composables/appearance/useTexture'
import { DEFAULT_PLANES, applyTexture, configureTexture, TEXTURES, textureConfig } from '../src/composables/appearance/internal/texture'

const root = document.documentElement

// The module holds one shared configuration, so tests restore it here instead
// of through a test-only reset export.
function defaults() {
  configureTexture({
    name: 'grain',
    gain: 1,
    scale: 1,
    ink: '',
    planes: { ...DEFAULT_PLANES },
    textures: { ground: '', chrome: '', well: '', overlay: '' },
    storageKey: 's99ab.texture',
  })
}

beforeEach(() => {
  localStorage.clear()
  root.removeAttribute('data-texture')
  root.removeAttribute('style')
  defaults()
})

afterEach(() => {
  localStorage.clear()
})

describe('texture catalogue', () => {
  // Files, Sass map and TEXTURES are kept by hand; the demo renders swatches from TEXTURES.
  it('names exactly the files on disk', () => {
    const files = readdirSync(resolve(process.cwd(), 'public/textures'))
      .filter(name => name.endsWith('.svg'))
      .map(name => basename(name, '.svg'))
      .sort()

    expect(TEXTURES.map(spec => spec.name).sort()).toEqual(files)
  })

  it('names exactly the Sass map', () => {
    const sheet = readFileSync(resolve(process.cwd(), 'src/styles/_textures.scss'), 'utf8')

    // From $textures only; $tex-planes has the same shape and would add `ground` and `glass`.
    const start = sheet.indexOf('$textures: (')
    const body = sheet.slice(start, sheet.indexOf('\n) !default;', start))
    const mapped = [...body.matchAll(/^ {2}'([a-z]+)':\s*\(/gm)].map(m => m[1]!).sort()

    expect(TEXTURES.map(spec => spec.name).sort()).toEqual(mapped)
  })

  // `none` has no file and would render a blank swatch.
  it('does not offer none as a file', () => {
    expect(TEXTURES.some(spec => spec.name === 'none')).toBe(false)
  })
})

describe('applyTexture', () => {
  it('writes the name as an attribute', () => {
    applyTexture({ name: 'dots' })

    expect(root.getAttribute('data-texture')).toBe('dots')
  })

  it('writes every plane strength', () => {
    applyTexture({ planes: { well: 0.2 } })

    expect(root.style.getPropertyValue('--s99ab-tex-well')).toBe('0.2')
    expect(root.style.getPropertyValue('--s99ab-tex-ground')).toBe('0.16')
  })

  // Spreading a nested map replaces it, so patching one plane must keep the others.
  it('patches one plane without dropping the rest', () => {
    configureTexture({ planes: { well: 0.2 } })

    expect(textureConfig().planes.well).toBe(0.2)
    expect(textureConfig().planes.ground).toBe(DEFAULT_PLANES.ground)
  })

  // Each plane can take its own texture.
  it('gives a plane a texture of its own', () => {
    applyTexture({ name: 'grain', textures: { chrome: 'hatch' } })

    expect(root.getAttribute('data-texture')).toBe('grain')
    expect(root.getAttribute('data-tex-chrome')).toBe('hatch')
    expect(root.getAttribute('data-tex-well')).toBeNull()
  })

  // Empty clears the attribute, so the plane falls back to the global pick.
  it('clears a plane back to following the global pick', () => {
    applyTexture({ textures: { chrome: 'hatch' } })
    applyTexture({ textures: { chrome: '' } })

    expect(root.getAttribute('data-tex-chrome')).toBeNull()
  })

  // 'none' on one plane opts it out while the others keep the global texture.
  it('lets one plane opt out while the others keep theirs', () => {
    applyTexture({ name: 'grain', textures: { well: 'none' } })

    expect(root.getAttribute('data-tex-well')).toBe('none')
    expect(root.getAttribute('data-texture')).toBe('grain')
  })

  // A plane owns its texture and its ink strength, nothing else.
  it('writes only the strength and the texture per plane', () => {
    applyTexture({ planes: { ground: 0.4 }, textures: { chrome: 'hatch' } })

    expect(root.style.getPropertyValue('--s99ab-tex-ground')).toBe('0.4')
    expect(root.getAttribute('data-tex-chrome')).toBe('hatch')
    expect(root.style.getPropertyValue('--s99ab-tex-ground-scale')).toBe('')
    expect(root.style.getPropertyValue('--s99ab-tex-chrome-ink')).toBe('')
  })

  it('patches one plane strength without dropping the rest', () => {
    configureTexture({ planes: { ground: 0.2, well: 0.3 } })
    configureTexture({ planes: { ground: 0.15 } })

    expect(textureConfig().planes.ground).toBe(0.15)
    expect(textureConfig().planes.well).toBe(0.3)
  })

  it('rejects a plane texture that is not in the catalogue', () => {
    applyTexture({ textures: { chrome: 'nonsense' } })

    expect(root.getAttribute('data-tex-chrome')).toBeNull()
  })

  // An empty ink keeps _textures.scss's theme default instead of writing an empty property.
  it('leaves the ink alone when it is empty', () => {
    applyTexture({ ink: '' })

    expect(root.style.getPropertyValue('--s99ab-tex-ink')).toBe('')
  })

  it('writes an ink that was given', () => {
    applyTexture({ ink: 'rgb(var(--v-theme-accent))' })

    expect(root.style.getPropertyValue('--s99ab-tex-ink'))
      .toBe('rgb(var(--v-theme-accent))')
  })

  // An unknown name would select nothing and look like `none`.
  it('rejects a name that is not in the catalogue', () => {
    applyTexture({ name: 'nonsense' })

    expect(root.getAttribute('data-texture')).toBe('grain')
  })

  it('keeps the rest of a patch whose name was rejected', () => {
    applyTexture({ name: 'nonsense', gain: 0.5 })

    expect(root.getAttribute('data-texture')).toBe('grain')
    expect(root.style.getPropertyValue('--s99ab-tex-gain')).toBe('0.5')
  })

  it('accepts none, which is not a file', () => {
    applyTexture({ name: 'none' })

    expect(root.getAttribute('data-texture')).toBe('none')
  })
})

describe('the reader\'s own pick', () => {
  it('remembers a texture and restores it', () => {
    useTexture().set('dots')
    applyTexture({ name: 'grain' })

    useTexture().restore()

    expect(root.getAttribute('data-texture')).toBe('dots')
  })

  it('remembers a plane\'s own texture and restores it', () => {
    useTexture().setPlane('chrome', 'hatch')
    applyTexture({ textures: { chrome: '' } })

    useTexture().restore()

    expect(root.getAttribute('data-tex-chrome')).toBe('hatch')
  })

  // A stored name whose file is gone is ignored.
  it('ignores a stored name it no longer has', () => {
    localStorage.setItem('s99ab.texture.name', 'gone')

    useTexture().restore()

    expect(root.getAttribute('data-texture')).toBe('grain')
  })

  it('offers none in front of the catalogue', () => {
    const { options } = useTexture()

    expect(options.value[0]).toBe('none')
    expect(options.value).toHaveLength(TEXTURES.length + 1)
  })
})
