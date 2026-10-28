// web/src/markdown.ts
//
// The markdown subset and highlighter as plain functions: `@smegg99/s99ab/markdown`.

export { parseInline, parseMarkdown, type Block, type Inline } from './composables/markdown/internal/markdown'
export { tokenise, type Highlightable, type Token, type TokenKind } from './composables/markdown/internal/highlight'
