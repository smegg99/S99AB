// web/tests/markdown.spec.ts

import { describe, expect, it } from 'vitest'
import { type Block, parseInline, parseMarkdown } from '../src/composables/markdown/useMarkdown'

function textOf(block: Block): string {
  if (block.type === 'code') return block.value
  if (block.type === 'rule') return ''
  if (block.type === 'list') {
    return block.items.map(item => item.map(t => t.value).join('')).join(' | ')
  }
  return block.inline.map(t => t.value).join('')
}

describe('blocks', () => {
  it('reads the shapes a release note is written in', () => {
    const blocks = parseMarkdown([
      '## What\'s new',
      '',
      'Fixed the thing, and the other thing.',
      '',
      '- one',
      '- two',
      '',
      '1. first',
      '2. second',
      '',
      '> a note',
      '',
      '---',
      '',
      '```sh',
      'just build',
      '```',
    ].join('\n'))

    expect(blocks.map(b => b.type)).toEqual([
      'heading', 'paragraph', 'list', 'list', 'quote', 'rule', 'code',
    ])
    expect(textOf(blocks[2]!)).toBe('one | two')
    expect(blocks[3]).toMatchObject({ type: 'list', ordered: true })
    expect(blocks[6]).toMatchObject({ type: 'code', lang: 'sh', value: 'just build' })
  })

  it('joins a wrapped paragraph into one', () => {
    const blocks = parseMarkdown('a sentence\nthat wrapped\n\nand another')
    expect(blocks).toHaveLength(2)
    expect(textOf(blocks[0]!)).toBe('a sentence that wrapped')
  })

  it('keeps the rest of the document when a fence is never closed', () => {
    const blocks = parseMarkdown('# Title\n\n```\nunterminated')
    expect(blocks.map(b => b.type)).toEqual(['heading', 'code'])
    expect(textOf(blocks[1]!)).toBe('unterminated')
  })

  it('starts a new list when the marker changes, so numbering does not carry', () => {
    const blocks = parseMarkdown('1. first\n2. second\n- bullet')
    expect(blocks).toHaveLength(2)
    expect(blocks[0]).toMatchObject({ ordered: true })
    expect(blocks[1]).toMatchObject({ ordered: false })
  })

  it('survives CRLF, which is what GitHub returns', () => {
    expect(parseMarkdown('# One\r\n\r\ntext\r\n').map(b => b.type)).toEqual(['heading', 'paragraph'])
  })
})

describe('inline', () => {
  it('reads code, links, strong and emphasis', () => {
    expect(parseInline('run `just check` for **all** of _it_')).toEqual([
      { type: 'text', value: 'run ' },
      { type: 'code', value: 'just check' },
      { type: 'text', value: ' for ' },
      { type: 'strong', value: 'all' },
      { type: 'text', value: ' of ' },
      { type: 'em', value: 'it' },
    ])
  })

  it('does not read emphasis inside code', () => {
    expect(parseInline('`**not bold**`')).toEqual([{ type: 'code', value: '**not bold**' }])
  })

  it('keeps a link\'s text and href', () => {
    expect(parseInline('see [the docs](https://example.test/a)')).toEqual([
      { type: 'text', value: 'see ' },
      { type: 'link', value: 'the docs', href: 'https://example.test/a' },
    ])
  })

  // Release bodies come from the repository owners, but the renderer still sanitises them.
  it('strips a javascript: href and keeps the text', () => {
    const [token] = parseInline('[click](javascript:alert(1))')
    expect(token).toEqual({ type: 'link', value: 'click', href: '' })
  })

  it('allows relative and mailto links', () => {
    expect(parseInline('[a](/docs)')[0]).toMatchObject({ href: '/docs' })
    expect(parseInline('[b](mailto:x@example.test)')[0]).toMatchObject({ href: 'mailto:x@example.test' })
  })
})
