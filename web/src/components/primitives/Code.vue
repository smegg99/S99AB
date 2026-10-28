<!-- web/src/components/primitives/Code.vue -->
<template>
  <div class="s99ab-code">
    <!-- The copy button sits over the block. -->
    <v-btn
      v-if="copyable"
      :aria-label="copied ? doneLabel : copyLabel"
      :icon="copied ? 'mdi-check' : 'mdi-content-copy'"
      :title="copied ? doneLabel : copyLabel"
      class="s99ab-code__copy"
      size="small"
      variant="text"
      @click="copy(source)"
    />

    <pre
      class="s99ab-code__pre"
      tabindex="0"
    ><code><span
      v-for="(token, index) in tokens"
      :key="index"
      :class="`s99ab-code__${token.kind}`"
    >{{ token.text }}</span></code></pre>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { tokenise, type Highlightable } from '../../composables/markdown/internal/highlight'
import { useCopy } from '../../composables/useCopy'
import { useTranslate } from '../../composables/useTranslate'

/**
 * A highlighted code block with a copy button. Colours are theme tokens; the
 * pre has tabindex so a scrolling block is keyboard-reachable.
 */
const {
  source,
  lang = 'ts',
  copyable = true,
} = defineProps<{
  /** Rendered as given; the tokeniser is lossless. */
  source: string
  lang?: Highlightable
  copyable?: boolean
}>()

const { copied, copy } = useCopy()
const t = useTranslate()

const tokens = computed(() => tokenise(source, lang))

const copyLabel = computed(() => t('common.copy', 'Copy'))
const doneLabel = computed(() => t('common.copied', 'Copied'))
</script>

<style scoped>
.s99ab-code {
  position: relative;
}

/* Padding on the button's side so the first line does not run under it. */
.s99ab-code__pre {
  overflow: auto;
  margin: 0;
  padding: var(--s99ab-pad-tight);
  padding-inline-end: calc(var(--s99ab-control-h) + var(--s99ab-pad-tight));
  border: 1px solid rgb(var(--v-theme-lineSoft));
  border-radius: var(--s99ab-radius);
  background: rgb(var(--v-theme-sunk));
  color: rgb(var(--v-theme-ink2));
  font-family: var(--s99ab-font-mono);
  font-size: 0.78rem;
  line-height: 1.55;
  tab-size: 2;
}

.s99ab-code__copy {
  position: absolute;
  top: var(--s99ab-control-gap);
  inset-inline-end: var(--s99ab-control-gap);
  z-index: 1;
}

/* Theme tokens: comments ink3, strings and numbers in two distinct status hues,
   keywords in the accent. */
.s99ab-code__comment {
  color: rgb(var(--v-theme-ink3));
  font-style: italic;
}

.s99ab-code__string {
  color: rgb(var(--v-theme-ok-lit));
}

.s99ab-code__number {
  color: rgb(var(--v-theme-warn-lit));
}

.s99ab-code__keyword {
  color: rgb(var(--v-theme-accent));
}

.s99ab-code__property {
  color: rgb(var(--v-theme-info-lit));
}

.s99ab-code__punctuation {
  color: rgb(var(--v-theme-ink3));
}
</style>
