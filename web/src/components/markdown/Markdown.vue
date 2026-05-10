<!-- web/src/components/markdown/Markdown.vue -->
<template>
  <div class="s99ab-md">
    <template
      v-for="(block, i) in blocks"
      :key="i"
    >
      <component
        :is="block.tag"
        v-if="block.type === 'heading'"
        :class="{ 's99ab-md__heading--label': block.label }"
        class="s99ab-md__heading"
      >
        <UiMarkdownInline :tokens="block.inline" />
      </component>

      <p v-else-if="block.type === 'paragraph'">
        <UiMarkdownInline :tokens="block.inline" />
      </p>

      <component
        :is="block.tag"
        v-else-if="block.type === 'list'"
        class="s99ab-md__list"
      >
        <li
          v-for="(item, j) in block.items"
          :key="j"
        >
          <UiMarkdownInline :tokens="item" />
        </li>
      </component>

      <pre
        v-else-if="block.type === 'code'"
        class="s99ab-md__pre"
      ><code :class="block.codeClass">{{ block.value }}</code></pre>

      <blockquote
        v-else-if="block.type === 'quote'"
        class="s99ab-md__quote"
      >
        <UiMarkdownInline :tokens="block.inline" />
      </blockquote>

      <v-divider
        v-else-if="block.type === 'rule'"
        class="my-4"
      />
    </template>
  </div>
</template>

<script setup lang="ts">
import UiMarkdownInline from './MarkdownInline.vue'
import { useMarkdownView } from '../../composables/markdown/useMarkdownView'

// Every value is a text node, so Vue escapes it; no HTML is rendered.
const { source } = defineProps<{ source: string }>()

// A getter, so the composable sees later values of the prop.
const { blocks } = useMarkdownView(() => source)
</script>
