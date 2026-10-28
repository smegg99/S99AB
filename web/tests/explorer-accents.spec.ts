// web/tests/explorer-accents.spec.ts

import { beforeEach, describe, expect, it } from 'vitest'
import {
  accentTriplet,
  applyExplorerAccents,
  explorerAccentCss,
} from '../src/composables/explorer/internal/accents'

const styleEl = () => document.getElementById('s99ab-explorer-accents')

beforeEach(() => {
  styleEl()?.remove()
})

describe('a colour as a triplet', () => {
  it('takes hex in both lengths', () => {
    expect(accentTriplet('#e53935')).toBe('229, 57, 53')
    expect(accentTriplet('e53935')).toBe('229, 57, 53')
    expect(accentTriplet('#abc')).toBe('170, 187, 204')
  })

  it('takes a triplet already written as one, in either separator', () => {
    expect(accentTriplet('229, 57, 53')).toBe('229, 57, 53')
    expect(accentTriplet(' 229 57 53 ')).toBe('229, 57, 53')
  })

  // Anything that is not three numbers is refused, since the browser would drop it silently.
  it('refuses anything rgb(var(--x)) could not consume', () => {
    expect(accentTriplet('rebeccapurple')).toBeNull()
    expect(accentTriplet('hsl(210 40% 50%)')).toBeNull()
    expect(accentTriplet('229, 57')).toBeNull()
    expect(accentTriplet('229, 57, 300')).toBeNull()
    expect(accentTriplet('')).toBeNull()
  })
})

describe('the stylesheet a runtime tint needs', () => {
  it('writes the property and the rule that reaches every tinted thing', () => {
    const css = explorerAccentCss({ brand: '#1e88e5' })

    expect(css).toContain('--s99ab-accent-brand: 30, 136, 229;')
    expect(css).toContain('[data-accent="brand"] { --s99ab-tile-accent: var(--s99ab-accent-brand); }')
  })

  // A name that cannot go into a selector is dropped.
  it('skips a name or a colour it cannot use', () => {
    const css = explorerAccentCss({
      'brand': '#1e88e5',
      'not a name': '#000000',
      'ghost': 'transparent',
    })

    expect(css).toContain('accent-brand')
    expect(css).not.toContain('not a name')
    expect(css).not.toContain('ghost')
  })
})

describe('putting them on the document', () => {
  it('keeps one element, replaced rather than added to', () => {
    applyExplorerAccents({ brand: '#1e88e5' })
    applyExplorerAccents({ other: '#43a047' })

    expect(document.querySelectorAll('#s99ab-explorer-accents')).toHaveLength(1)
    expect(styleEl()?.textContent).toContain('accent-other')
    expect(styleEl()?.textContent).not.toContain('accent-brand')
  })

  it('takes the element away when the app declares none', () => {
    applyExplorerAccents({ brand: '#1e88e5' })
    applyExplorerAccents({})

    expect(styleEl()).toBeNull()
  })
})
