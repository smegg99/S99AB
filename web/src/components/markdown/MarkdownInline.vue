<!-- web/src/components/markdown/MarkdownInline.vue -->
<template>
  <template
    v-for="(token, i) in tokens"
    :key="i"
  >
    <code v-if="token.type === 'code'">{{ token.value }}</code>

    <strong v-else-if="token.type === 'strong'">{{ token.value }}</strong>

    <em v-else-if="token.type === 'em'">{{ token.value }}</em>

    <!-- An unsafe scheme parses to an empty href; the text is still shown. -->
    <a
      v-else-if="token.type === 'link' && token.href"
      :href="token.href"
      :aria-label="linkLabel(token.value)"
      target="_blank"
      rel="noopener noreferrer"
    >{{ token.value }}</a>

    <template v-else>
      {{ token.value }}
    </template>
  </template>
</template>

<script setup lang="ts">
import type { Inline } from '../../composables/markdown/useMarkdown'
import { useTranslate } from '../../composables/useTranslate'

// Every value is a text node, so Vue escapes it; no HTML is rendered. A token
// list has no root element, so attrs are dropped explicitly.
defineOptions({ inheritAttrs: false })

const { tokens } = defineProps<{ tokens: Inline[] }>()

const t = useTranslate()

// Links open a new tab, so the label warns about it. The whole name is one
// translatable message.
function linkLabel(text: string): string {
  return t('common.linkNewTab', '{text} (opens in a new tab)', { text })
}
</script>
