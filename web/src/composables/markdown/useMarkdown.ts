// web/src/composables/markdown/useMarkdown.ts

// A markdown subset parsed to a tree the renderer walks: headings, paragraphs,
// lists, links, emphasis, code, quotes and rules. Unknown syntax stays as text.
// No HTML is produced; the renderer emits text nodes.

export type Inline
  = | { type: 'text', value: string }
    | { type: 'code', value: string }
    | { type: 'strong', value: string }
    | { type: 'em', value: string }
    | { type: 'link', value: string, href: string }

export type Block
  = | { type: 'heading', level: number, inline: Inline[] }
    | { type: 'paragraph', inline: Inline[] }
    | { type: 'list', ordered: boolean, items: Inline[][] }
    | { type: 'code', value: string, lang: string }
    | { type: 'quote', inline: Inline[] }
    | { type: 'rule' }

const HEADING = /^(#{1,6})\s+(.*)$/
const BULLET = /^[-*+]\s+(.*)$/
const ORDERED = /^\d+[.)]\s+(.*)$/
const RULE = /^(?:-{3,}|\*{3,}|_{3,})$/
const FENCE = /^```(\w*)\s*$/
const QUOTE = /^>\s?(.*)$/

/** Parses markdown into blocks. Never throws; unknown syntax stays as text. */
export function parseMarkdown(md: string): Block[] {
  const lines = md.replace(/\r\n?/g, '\n').split('\n')
  const blocks: Block[] = []

  let paragraph: string[] = []
  let list: { ordered: boolean, items: string[] } | null = null

  function flushParagraph() {
    if (!paragraph.length) return
    blocks.push({ type: 'paragraph', inline: parseInline(paragraph.join(' ')) })
    paragraph = []
  }

  function flushList() {
    if (!list) return
    blocks.push({
      type: 'list',
      ordered: list.ordered,
      items: list.items.map(parseInline),
    })
    list = null
  }

  function flush() {
    flushParagraph()
    flushList()
  }

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i]!
    const trimmed = line.trim()

    const fence = FENCE.exec(trimmed)
    if (fence) {
      flush()
      const code: string[] = []
      // An unterminated fence runs to the end, as in a truncated release body.
      for (i++; i < lines.length && !FENCE.test(lines[i]!.trim()); i++) {
        code.push(lines[i]!)
      }
      blocks.push({ type: 'code', value: code.join('\n'), lang: fence[1] ?? '' })
      continue
    }

    if (!trimmed) {
      flush()
      continue
    }

    if (RULE.test(trimmed)) {
      flush()
      blocks.push({ type: 'rule' })
      continue
    }

    const heading = HEADING.exec(trimmed)
    if (heading) {
      flush()
      blocks.push({
        type: 'heading',
        level: heading[1]!.length,
        inline: parseInline(heading[2]!),
      })
      continue
    }

    const quote = QUOTE.exec(trimmed)
    if (quote) {
      flush()
      blocks.push({ type: 'quote', inline: parseInline(quote[1]!) })
      continue
    }

    const bullet = BULLET.exec(trimmed)
    const ordered = ORDERED.exec(trimmed)
    if (bullet || ordered) {
      flushParagraph()
      const isOrdered = Boolean(ordered)
      // A change of marker starts a new list.
      if (!list || list.ordered !== isOrdered) {
        flushList()
        list = { ordered: isOrdered, items: [] }
      }
      list.items.push((bullet?.[1] ?? ordered![1])!)
      continue
    }

    flushList()
    paragraph.push(trimmed)
  }

  flush()
  return blocks
}

const CODE = /`([^`]+)`/
const LINK = /\[([^\]]*)\]\(([^)\s]+)\)/
const STRONG = /\*\*([^*]+)\*\*|__([^_]+)__/
const EM = /\*([^*]+)\*|_([^_]+)_/

/** Splits one line into inline pieces. Code first, since its content is literal. */
export function parseInline(text: string): Inline[] {
  const out: Inline[] = []

  let rest = text
  while (rest) {
    const code = CODE.exec(rest)
    const link = LINK.exec(rest)
    const strong = STRONG.exec(rest)
    const em = EM.exec(rest)

    const next = [code, link, strong, em]
      .filter((m): m is RegExpExecArray => m !== null)
      .sort((a, b) => a.index - b.index)[0]

    if (!next) {
      out.push({ type: 'text', value: rest })
      break
    }

    if (next.index > 0) out.push({ type: 'text', value: rest.slice(0, next.index) })

    if (next === code) out.push({ type: 'code', value: next[1]! })
    else if (next === link) out.push({ type: 'link', value: next[1]!, href: safeHref(next[2]!) })
    else if (next === strong) out.push({ type: 'strong', value: (next[1] ?? next[2])! })
    else out.push({ type: 'em', value: (next[1] ?? next[2])! })

    rest = rest.slice(next.index + next[0].length)
  }

  return out.filter(token => token.type !== 'text' || token.value !== '')
}

/** Only http, https and mailto hrefs survive. */
function safeHref(href: string): string {
  return /^(https?:|mailto:|[/#])/i.test(href.trim()) ? href : ''
}
