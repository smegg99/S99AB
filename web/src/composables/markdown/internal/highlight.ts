// web/src/composables/markdown/internal/highlight.ts

// A small tokenising highlighter for TS and CSS, kept free of a grammar
// dependency. Output is built from input slices, so a miss only miscolours.

/** What a slice of source was recognised as. */
export type TokenKind
  = | 'comment'
    | 'string'
    | 'number'
    | 'keyword'
    | 'property'
    | 'punctuation'
    | 'plain'

export interface Token {
  kind: TokenKind
  text: string
}

/** The languages this knows. Anything else is returned as one plain token. */
export type Highlightable = 'ts' | 'css'

const KEYWORDS = new Set([
  'export', 'default', 'import', 'from', 'const', 'let', 'var', 'function',
  'return', 'await', 'async', 'new', 'class', 'extends', 'interface', 'type',
  'true', 'false', 'null', 'undefined', 'if', 'else', 'for', 'of', 'in',
])

/** Source as tokens, in order; concatenating every `text` returns the input exactly. */
export function tokenise(source: string, lang: Highlightable = 'ts'): Token[] {
  const tokens: Token[] = []
  let plain = ''

  const flush = () => {
    if (plain) tokens.push({ kind: 'plain', text: plain })
    plain = ''
  }

  const push = (kind: TokenKind, text: string) => {
    flush()
    tokens.push({ kind, text })
  }

  let i = 0

  while (i < source.length) {
    const rest = source.slice(i)

    // Comments first, so their content is not tokenised.
    const line = /^\/\/[^\n]*/.exec(rest)
    if (line) {
      push('comment', line[0])
      i += line[0].length
      continue
    }

    const block = /^\/\*[\s\S]*?\*\//.exec(rest)
    if (block) {
      push('comment', block[0])
      i += block[0].length
      continue
    }

    // The escape class keeps \' from ending a string early.
    const string = /^(['"`])(?:\\.|(?!\1)[^\\])*\1?/.exec(rest)
    if (string) {
      push('string', string[0])
      i += string[0].length
      continue
    }

    // A CSS custom property is a name; matched before numbers take its digits.
    if (lang === 'css') {
      const custom = /^--[\w-]+/.exec(rest)
      if (custom) {
        push('property', custom[0])
        i += custom[0].length
        continue
      }
    }

    const number = /^-?\d+(?:\.\d+)?(?:px|rem|em|ch|%|s|ms|deg)?\b/.exec(rest)
    if (number) {
      push('number', number[0])
      i += number[0].length
      continue
    }

    const word = /^[A-Za-z_$][\w$-]*/.exec(rest)
    if (word) {
      const after = source.slice(i + word[0].length)
      const isKey = /^\s*:/.test(after)

      push(KEYWORDS.has(word[0]) ? 'keyword' : isKey ? 'property' : 'plain', word[0])
      i += word[0].length
      continue
    }

    const punctuation = /^[{}[\]():;,]/.exec(rest)
    if (punctuation) {
      push('punctuation', punctuation[0])
      i += punctuation[0].length
      continue
    }

    plain += source[i]
    i += 1
  }

  flush()
  return tokens
}
