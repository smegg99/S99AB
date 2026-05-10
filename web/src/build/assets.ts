// web/src/build/assets.ts
//
// Build-time passes that drop unused icon rules and non-woff2 font files from
// the emitted bundle. Both remove only unreferenced output and skip the bundle
// when the evidence looks wrong.

import type { Plugin } from 'vite'

/** A @mdi/font CSS rule. The minifier decodes the codepoint, and the selector
 *  may have one colon or two. */
const ICON_RULE = /\.mdi-([a-z0-9-]+):{1,2}before\{content:"[^"]*"\}/g

/** An icon reference anywhere else: a compiled template, a Vuetify alias, a class. */
const ICON_TOKEN = /mdi-[a-z0-9-]+/g

/** Icon names built at runtime, which a static scan cannot see. */
const DYNAMIC_ICON = /(["'`]mdi-["'`]\s*\+)|(`[^`]*mdi-\$\{)/

export interface IconSubsetOptions {
  /** Icon names to keep, with or without the `mdi-` prefix. */
  safelist?: string[]
  /** Skip the pass, for an app that builds every icon name at runtime. */
  disabled?: boolean
}

/**
 * s99abIconSubset drops the Material Design Icons rules nothing references.
 * Every chunk and every stylesheet (minus the icon rules themselves) is scanned
 * for names. The font file is untouched. When the scan finds no icons or a
 * runtime-built name, it leaves the bundle alone and logs why.
 */
export function s99abIconSubset(options: IconSubsetOptions = {}): Plugin {
  const safelist = new Set(
    (options.safelist ?? []).map(name => (name.startsWith('mdi-') ? name : `mdi-${name}`)),
  )

  return {
    name: 's99ab:icon-subset',
    apply: 'build',
    enforce: 'post',

    generateBundle(_outputOptions, bundle) {
      if (options.disabled) return

      // Nuxt also runs this over the nitro bundle, which has no icon rules; skip
      // it without a warning.
      const hasIconRules = Object.values(bundle).some(file =>
        file.type === 'asset' && file.fileName.endsWith('.css') && ICON_RULE.test(String(file.source)),
      )
      // A /g regex carries lastIndex between calls, and .test advances it.
      ICON_RULE.lastIndex = 0
      if (!hasIconRules) return

      const used = new Set(safelist)
      let dynamic = false

      for (const file of Object.values(bundle)) {
        if (file.type === 'chunk') {
          if (DYNAMIC_ICON.test(file.code)) dynamic = true
          for (const token of file.code.match(ICON_TOKEN) ?? []) used.add(token)
          continue
        }
        if (!file.fileName.endsWith('.css') && !file.fileName.endsWith('.html')) continue
        // Icon rules are stripped first so the catalogue does not count as a use.
        const rest = String(file.source).replace(ICON_RULE, '')
        for (const token of rest.match(ICON_TOKEN) ?? []) used.add(token)
      }

      if (dynamic) {
        this.warn(
          's99ab:icon-subset: an icon name is built at runtime, so a static scan cannot see it. '
          + 'Left the stylesheet whole. Pass the names through the plugin\'s safelist to subset anyway.',
        )
        return
      }
      if (used.size === 0) {
        this.warn('s99ab:icon-subset: found no icon references at all, which is not believable. Left the stylesheet whole.')
        return
      }

      let removed = 0
      let saved = 0
      for (const file of Object.values(bundle)) {
        if (file.type !== 'asset' || !file.fileName.endsWith('.css')) continue
        const before = String(file.source)
        const after = before.replace(ICON_RULE, (rule, name: string) => {
          if (used.has(`mdi-${name}`)) return rule
          removed++
          return ''
        })
        if (after === before) continue
        saved += before.length - after.length
        file.source = after
      }

      if (removed > 0) {
        this.info(`s99ab:icon-subset: kept ${used.size} icons, dropped ${removed} rules (${Math.round(saved / 1024)} KB)`)
      }
    },
  }
}

/**
 * Every font format except woff2. The trailing group keeps `.woff` from
 * matching `.woff2`, and must include `)` for a CSS url() with no query.
 */
const LEGACY_FONT = /\.(eot|ttf|otf|woff)(\?|#|\)|"|'|$)/i

export interface ModernFontsOptions {
  /** Skip the pass, for an app targeting a browser without woff2. */
  disabled?: boolean
}

/**
 * s99abModernFonts keeps only the woff2 of each font. Legacy entries are dropped
 * per @font-face src list; a face left empty is restored untouched, and a font
 * file is deleted only when no stylesheet or chunk mentions it.
 */
export function s99abModernFonts(options: ModernFontsOptions = {}): Plugin {
  return {
    name: 's99ab:modern-fonts',
    apply: 'build',
    enforce: 'post',

    generateBundle(_outputOptions, bundle) {
      if (options.disabled) return

      for (const file of Object.values(bundle)) {
        if (file.type !== 'asset' || !file.fileName.endsWith('.css')) continue
        file.source = String(file.source).replace(/@font-face\{([^}]*)\}/g,
          (whole, body: string) => `@font-face{${rewriteFace(body) ?? body}}`)
      }

      // Checked after every stylesheet has been rewritten.
      const referenced = new Set<string>()
      for (const file of Object.values(bundle)) {
        const text = file.type === 'chunk' ? file.code : String(file.source)
        for (const name of text.match(/[\w.-]+\.(eot|ttf|otf|woff2?)/gi) ?? []) {
          referenced.add(name.split('/').pop()!)
        }
      }

      let dropped = 0
      let saved = 0
      for (const [fileName, file] of Object.entries(bundle)) {
        if (file.type !== 'asset' || !LEGACY_FONT.test(fileName)) continue
        if (referenced.has(fileName.split('/').pop()!)) continue
        saved += byteLength(file.source)
        dropped++
        // Reflect, since the lint rule rejects a computed `delete`.
        Reflect.deleteProperty(bundle, fileName)
      }

      if (dropped > 0) {
        this.info(`s99ab:modern-fonts: dropped ${dropped} pre-woff2 font files (${Math.round(saved / 1024)} KB)`)
      }
    },
  }
}

/**
 * rewriteFace collapses a @font-face body to its woff2 sources, or returns null.
 * The whole face is rewritten because @mdi/font spreads sources over two `src:`
 * declarations.
 */
function rewriteFace(body: string): string | null {
  const decls = splitTop(body, ';')
  const entries = decls
    .filter(d => d.startsWith('src:'))
    .flatMap(d => splitTop(d.slice(4), ','))
  if (entries.length === 0) return null

  const kept = entries.filter(entry => !LEGACY_FONT.test(entry))
  // Every source is legacy, so the app needs it as is.
  if (kept.length === 0 || kept.length === entries.length) return null

  let placed = false
  const out: string[] = []
  for (const decl of decls) {
    if (!decl.startsWith('src:')) {
      out.push(decl)
      continue
    }
    // One src declaration, in the first one's position.
    if (!placed) {
      out.push(`src:${kept.join(',')}`)
      placed = true
    }
  }
  return out.join(';')
}

/** Splits on a delimiter at paren depth zero, ignoring ones inside url() or data: URIs. */
function splitTop(text: string, delimiter: string): string[] {
  const out: string[] = []
  let depth = 0
  let start = 0
  for (let i = 0; i < text.length; i++) {
    const c = text[i]
    if (c === '(') depth++
    else if (c === ')') depth--
    else if (c === delimiter && depth === 0) {
      out.push(text.slice(start, i).trim())
      start = i + 1
    }
  }
  const tail = text.slice(start).trim()
  if (tail) out.push(tail)
  return out.filter(Boolean)
}

function byteLength(source: string | Uint8Array): number {
  return typeof source === 'string' ? Buffer.byteLength(source) : source.length
}
