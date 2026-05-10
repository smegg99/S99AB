// web/tests/highlight.spec.ts

import { createVuetify } from 'vuetify'
import * as components from 'vuetify/components'
import * as directives from 'vuetify/directives'
import { mount } from '@vue/test-utils'
import { describe, expect, it } from 'vitest'
import Code from '../src/components/primitives/Code.vue'
import { tokenise } from '../src/composables/markdown/useHighlight'
import { fakeI18n } from './fake-i18n'

const vuetify = createVuetify({ components, directives })

function mountCode(props: Record<string, unknown>) {
  return mount(Code, {
    props: props as never,
    global: { plugins: [vuetify, fakeI18n(k => k)] },
  })
}

describe('tokenise', () => {
  // No character may be lost, for every token rule and for input none matches.
  const SAMPLES = [
    'const a = 1',
    '// a comment\nconst a = \'two\'',
    '/* block */ export default { a: 1 }',
    ':root {\n  --s99ab-radius: 3px;\n}',
    'const s = \'it\\\'s escaped\'',
    'weird ¤ characters «» and 日本語',
    '',
    '\n\n\n',
    'unterminated = \'oops',
  ]

  it.each(SAMPLES)('puts every character back: %j', (source) => {
    for (const lang of ['ts', 'css'] as const) {
      expect(tokenise(source, lang).map(t => t.text).join('')).toBe(source)
    }
  })

  it('reads a comment before anything inside it', () => {
    const [first] = tokenise('// const x = \'y\'')
    expect(first).toEqual({ kind: 'comment', text: '// const x = \'y\'' })
  })

  // Escaped quotes do not end a string.
  it('does not end a string on an escaped quote', () => {
    const string = tokenise('\'a\\\'b\'').find(t => t.kind === 'string')
    expect(string?.text).toBe('\'a\\\'b\'')
  })

  // A custom property is one name, digits included (`--s99ab-radius`).
  it('reads a custom property as one name in css', () => {
    const tokens = tokenise('--s99ab-radius: 3px;', 'css')

    expect(tokens[0]).toEqual({ kind: 'property', text: '--s99ab-radius' })
    expect(tokens.some(t => t.kind === 'number' && t.text === '3px')).toBe(true)
  })

  it('tells a key from a keyword from a value', () => {
    const kinds = Object.fromEntries(
      tokenise('export const a = { name: true }').map(t => [t.text, t.kind]),
    )

    expect(kinds.export).toBe('keyword')
    expect(kinds.const).toBe('keyword')
    expect(kinds.name).toBe('property')
    expect(kinds.true).toBe('keyword')
  })
})

describe('UiCode', () => {
  it('renders the source exactly, coloured', () => {
    const source = 'const a = \'b\' // c'
    const w = mountCode({ source })

    expect(w.find('pre').text()).toBe(source)
    expect(w.find('.s99ab-code__comment').text()).toBe('// c')
    expect(w.find('.s99ab-code__string').text()).toBe('\'b\'')
  })

  // A scrolling block is keyboard reachable.
  it('lets the keyboard reach a block that scrolls', () => {
    expect(mountCode({ source: 'x' }).find('pre').attributes('tabindex')).toBe('0')
  })

  it('withholds the copy button when asked', () => {
    expect(mountCode({ source: 'x' }).find('.s99ab-code__copy').exists()).toBe(true)
    expect(mountCode({ source: 'x', copyable: false }).find('.s99ab-code__copy').exists()).toBe(false)
  })
})
