// web/src/composables/explorer/useExplorerAccents.ts

// Runtime folder tints, emitted as the same two rules the _explorer.scss `@each`
// writes per accent, so every data-accent consumer picks them up.

const STYLE_ID = 's99ab-explorer-accents'

/** Safe in a custom property name and a selector. */
const NAME = /^[a-z][a-z0-9-]*$/i

/**
 * Hex or an r,g,b triplet as a comma triplet, else null. Named colours and hsl()
 * would break `rgba(var(--x), a)`.
 */
export function accentTriplet(value: string): string | null {
  const raw = value.trim()

  const hex = /^#?([0-9a-f]{3}|[0-9a-f]{6})$/i.exec(raw)
  if (hex) {
    const digits = hex[1]!
    const full = digits.length === 3 ? digits.replace(/./g, d => d + d) : digits
    const parts = [0, 2, 4].map(i => Number.parseInt(full.slice(i, i + 2), 16))
    return parts.join(', ')
  }

  const numbers = raw.split(/[\s,]+/).filter(Boolean).map(Number)
  const usable = numbers.length === 3
    && numbers.every(n => Number.isInteger(n) && n >= 0 && n <= 255)
  return usable ? numbers.join(', ') : null
}

/** CSS rules for a set of tints; invalid entries are skipped. */
export function explorerAccentCss(accents: Record<string, string>): string {
  const rules: string[] = []

  for (const [name, value] of Object.entries(accents)) {
    if (!NAME.test(name)) continue
    const rgb = accentTriplet(value)
    if (!rgb) continue

    rules.push(`:root { --s99ab-accent-${name}: ${rgb}; }`)
    rules.push(
      `[data-accent="${name}"] { --s99ab-tile-accent: var(--s99ab-accent-${name}); }`,
    )
  }

  return rules.join('\n')
}

/**
 * Writes the tints to one <style> at the end of head, replacing the previous set.
 * Its position lets it override equally specific stylesheet tints.
 */
export function applyExplorerAccents(accents: Record<string, string>) {
  if (typeof document === 'undefined') return

  const css = explorerAccentCss(accents)
  const existing = document.getElementById(STYLE_ID)

  if (!css) {
    existing?.remove()
    return
  }

  const style = existing ?? document.createElement('style')
  style.id = STYLE_ID
  style.textContent = css
  if (!existing) document.head.append(style)
}
