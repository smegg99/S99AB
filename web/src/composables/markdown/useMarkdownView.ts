// web/src/composables/markdown/useMarkdownView.ts

// The render-ready shape of a parsed document. Embedded prose gets two heading
// rungs (title, section label) so it never outranks the host page.

import { computed, type ComputedRef } from 'vue'
import { type Block, type Inline, parseMarkdown } from './useMarkdown'

export type MarkdownBlock
  = | { type: 'heading', tag: string, label: boolean, inline: Inline[] }
    | { type: 'paragraph', inline: Inline[] }
    | { type: 'list', tag: 'ol' | 'ul', items: Inline[][] }
    | { type: 'code', value: string, codeClass: string | undefined }
    | { type: 'quote', inline: Inline[] }
    | { type: 'rule' }

/** Heading 1 renders as h3: the page owns h1 and h2. */
const DEPTH_OFFSET = 2
const DEEPEST = 6
/** Deeper headings render as labels. */
const LABEL_FROM = 3

export function useMarkdownView(source: () => string): {
  blocks: ComputedRef<MarkdownBlock[]>
} {
  const blocks = computed(() => {
    const md = source()
    return md ? parseMarkdown(md).map(toBlock) : []
  })

  return { blocks }
}

function toBlock(block: Block): MarkdownBlock {
  switch (block.type) {
    case 'heading':
      return {
        type: 'heading',
        tag: `h${Math.min(block.level + DEPTH_OFFSET, DEEPEST)}`,
        label: block.level >= LABEL_FROM,
        inline: block.inline,
      }
    case 'list':
      return { type: 'list', tag: block.ordered ? 'ol' : 'ul', items: block.items }
    case 'code':
      // The class a highlighter looks for.
      return {
        type: 'code',
        value: block.value,
        codeClass: block.lang ? `language-${block.lang}` : undefined,
      }
    default:
      return block
  }
}
