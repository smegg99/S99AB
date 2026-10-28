<!-- web/src/components/primitives/Words.vue -->
<template>
  <!-- A line cut after a whole word: every word after the first is its own box, so the ellipsis takes whole words.
       The first word stays plain text, since WebKitGTK clips a line's first box instead of eliding it. -->
  <span><slot /><template
    v-for="(each, at) in wordBoxes(text, !!$slots.default)"
    :key="at"
  >{{ at || $slots.default ? ' ' : '' }}<span :class="{ 's99ab-words__word': each.box }">{{ each.word }}</span></template></span>
</template>

<script setup lang="ts">
import { wordBoxes } from '../../composables/primitives/internal/text'

const { text } = defineProps<{
  text: string
}>()
</script>

<style scoped>
.s99ab-words__word { display: inline-block; }
</style>
