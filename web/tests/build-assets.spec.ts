// web/tests/build-assets.spec.ts
//
// Both passes rewrite minified output with regexes and fail silently, so the
// cases cover careless rewrites that still produce plausible output.

import { describe, expect, it, vi } from 'vitest'
import { s99abIconSubset, s99abModernFonts } from '../src/build/assets'

/** The subset of Rollup's plugin context the passes touch. */
function context() {
  return { warn: vi.fn(), info: vi.fn() }
}

function css(fileName: string, source: string) {
  return { type: 'asset' as const, fileName, source, name: undefined, needsCodeReference: false }
}

function chunk(fileName: string, code: string) {
  return { type: 'chunk' as const, fileName, code }
}

/** Runs a plugin's generateBundle like Rollup and returns the bundle and the plugin's messages. */
function run(plugin: ReturnType<typeof s99abIconSubset>, bundle: Record<string, unknown>) {
  const ctx = context()
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  ;(plugin.generateBundle as any).call(ctx, {}, bundle)
  return { bundle, ctx }
}

const RULE = (name: string) => `.mdi-${name}:before{content:"\uF0004"}`

describe('s99abIconSubset', () => {
  it('keeps the icons something references and drops the rest', () => {
    const bundle = {
      'entry.css': css('entry.css', RULE('radar') + RULE('spider-web') + RULE('abacus')),
      'app.js': chunk('app.js', 'const nav=[{icon:"mdi-radar"},{icon:"mdi-spider-web"}]'),
    }

    run(s99abIconSubset(), bundle)

    const out = String(bundle['entry.css'].source)
    expect(out).toContain('.mdi-radar')
    expect(out).toContain('.mdi-spider-web')
    expect(out).not.toContain('.mdi-abacus')
  })

  // The catalogue names every icon, so scanning it unstripped would keep all 7500.
  it('does not count the catalogue as a use of itself', () => {
    const bundle = {
      'entry.css': css('entry.css', RULE('radar') + RULE('abacus')),
      'app.js': chunk('app.js', 'const i="mdi-radar"'),
    }

    run(s99abIconSubset(), bundle)

    expect(String(bundle['entry.css'].source)).not.toContain('.mdi-abacus')
  })

  // An icon referenced from another stylesheet (a ::before on a layer class) is kept.
  it('sees a reference from another stylesheet', () => {
    const bundle = {
      'entry.css': css('entry.css', RULE('radar') + RULE('abacus')),
      'page.css': css('page.css', '.thing .mdi-abacus{color:red}'),
      'app.js': chunk('app.js', 'const i="mdi-radar"'),
    }

    run(s99abIconSubset(), bundle)

    expect(String(bundle['entry.css'].source)).toContain('.mdi-abacus')
  })

  it('keeps a safelisted icon nothing references, with or without the prefix', () => {
    const bundle = {
      'entry.css': css('entry.css', RULE('radar') + RULE('abacus') + RULE('cog')),
      'app.js': chunk('app.js', 'const i="mdi-radar"'),
    }

    run(s99abIconSubset({ safelist: ['abacus', 'mdi-cog'] }), bundle)

    const out = String(bundle['entry.css'].source)
    expect(out).toContain('.mdi-abacus')
    expect(out).toContain('.mdi-cog')
  })

  // A name built at runtime cannot be scanned, so subsetting is refused.
  it('refuses to subset when a name is built at runtime, and says why', () => {
    const bundle = {
      'entry.css': css('entry.css', RULE('radar') + RULE('abacus')),
      'app.js': chunk('app.js', 'const i="mdi-"+kind'),
    }

    const { ctx } = run(s99abIconSubset(), bundle)

    expect(String(bundle['entry.css'].source)).toContain('.mdi-abacus')
    expect(ctx.warn).toHaveBeenCalledWith(expect.stringContaining('runtime'))
  })

  it('is silent on a bundle with no icons in it at all', () => {
    const bundle = { 'server.mjs': chunk('server.mjs', 'export default 1') }

    const { ctx } = run(s99abIconSubset(), bundle)

    expect(ctx.warn).not.toHaveBeenCalled()
    expect(ctx.info).not.toHaveBeenCalled()
  })

  it('does nothing when disabled', () => {
    const before = RULE('radar') + RULE('abacus')
    const bundle = { 'entry.css': css('entry.css', before), 'app.js': chunk('app.js', '') }

    run(s99abIconSubset({ disabled: true }), bundle)

    expect(String(bundle['entry.css'].source)).toBe(before)
  })
})

describe('s99abModernFonts', () => {
  // @mdi/font's real shape: an eot-only src declaration, then the modern list.
  // Rewriting per declaration leaves the legacy-only first one unchanged.
  const MDI_FACE = '@font-face{font-family:Material Design Icons;'
    + 'src:url(./mdi.eot?v=7);'
    + 'src:url(./mdi.eot?#iefix&v=7)format("embedded-opentype"),'
    + 'url(./mdi.woff2?v=7)format("woff2"),'
    + 'url(./mdi.woff?v=7)format("woff"),'
    + 'url(./mdi.ttf?v=7)format("truetype");'
    + 'font-weight:400;font-style:normal}'

  it('collapses a two-declaration face down to its woff2', () => {
    const bundle = {
      'entry.css': css('entry.css', MDI_FACE),
      'mdi.eot': css('mdi.eot', 'x'),
      'mdi.woff': css('mdi.woff', 'x'),
      'mdi.ttf': css('mdi.ttf', 'x'),
      'mdi.woff2': css('mdi.woff2', 'x'),
    }

    run(s99abModernFonts(), bundle)

    const out = String(bundle['entry.css'].source)
    expect(out).toContain('mdi.woff2')
    expect(out).not.toContain('.eot')
    expect(out).not.toContain('format("woff")')
    expect(out).not.toContain('.ttf')
    // The face's other properties survive in place.
    expect(out).toContain('font-family:Material Design Icons')
    expect(out).toContain('font-weight:400')
  })

  it('deletes the font files nothing references any more, and keeps the woff2', () => {
    const bundle = {
      'entry.css': css('entry.css', MDI_FACE),
      'mdi.eot': css('mdi.eot', 'x'),
      'mdi.woff': css('mdi.woff', 'x'),
      'mdi.ttf': css('mdi.ttf', 'x'),
      'mdi.woff2': css('mdi.woff2', 'x'),
    }

    run(s99abModernFonts(), bundle)

    expect(Object.keys(bundle).sort()).toEqual(['entry.css', 'mdi.woff2'])
  })

  // A face with no modern format is needed as-is; emptying it would never load.
  it('leaves a face with no woff2 exactly as it was', () => {
    const legacyOnly = '@font-face{font-family:Old;src:url(./old.ttf)format("truetype")}'
    const bundle = { 'entry.css': css('entry.css', legacyOnly), 'old.ttf': css('old.ttf', 'x') }

    run(s99abModernFonts(), bundle)

    expect(String(bundle['entry.css'].source)).toBe(legacyOnly)
    expect(bundle['old.ttf']).toBeDefined()
  })

  it('leaves a woff2-only face untouched', () => {
    const modern = '@font-face{font-family:New;src:url(./new.woff2)format("woff2")}'
    const bundle = { 'entry.css': css('entry.css', modern) }

    run(s99abModernFonts(), bundle)

    expect(String(bundle['entry.css'].source)).toBe(modern)
  })

  // woff2 starts with woff, so a careless suffix test would delete woff2.
  it('does not mistake woff2 for woff', () => {
    const bundle = {
      'entry.css': css('entry.css', '@font-face{font-family:X;src:url(./x.woff2)format("woff2"),url(./x.woff)format("woff")}'),
      'x.woff2': css('x.woff2', 'x'),
      'x.woff': css('x.woff', 'x'),
    }

    run(s99abModernFonts(), bundle)

    expect(bundle['x.woff2']).toBeDefined()
    expect(bundle['x.woff']).toBeUndefined()
    expect(String(bundle['entry.css'].source)).toContain('x.woff2')
  })

  // A legacy file a chunk still names is kept.
  it('keeps a legacy font a chunk still references', () => {
    const bundle = {
      'entry.css': css('entry.css', MDI_FACE),
      'app.js': chunk('app.js', 'const preload="mdi.ttf"'),
      'mdi.ttf': css('mdi.ttf', 'x'),
      'mdi.woff2': css('mdi.woff2', 'x'),
    }

    run(s99abModernFonts(), bundle)

    expect(bundle['mdi.ttf']).toBeDefined()
  })

  it('does nothing when disabled', () => {
    const bundle = { 'entry.css': css('entry.css', MDI_FACE), 'mdi.eot': css('mdi.eot', 'x') }

    run(s99abModernFonts({ disabled: true }), bundle)

    expect(String(bundle['entry.css'].source)).toBe(MDI_FACE)
    expect(bundle['mdi.eot']).toBeDefined()
  })
})
