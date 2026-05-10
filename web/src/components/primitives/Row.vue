<!-- web/src/components/primitives/Row.vue -->
<template>
  <div :class="classes">
    <slot />
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'

/**
 * Children in a line, separated by a spacing role, wrapping by default. For
 * cards, stats, chips and thumbnails; controls use `s99ab-controls`.
 */
const { gap = 'gap', wrap = true, align = 'center' } = defineProps<{
  /** A spacing role from styles/_config.scss; see UiStack. */
  gap?: 'gap' | 'tight' | 'control'
  wrap?: boolean
  /** Cross-axis alignment. `stretch` for cards that should share a height. */
  align?: 'start' | 'center' | 'end' | 'stretch'
}>()

const classes = computed(() => [
  's99ab-row',
  `s99ab-row--${gap}`,
  `s99ab-row--${align}`,
  { 's99ab-row--nowrap': !wrap },
])
</script>
