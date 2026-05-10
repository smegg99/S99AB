<!-- web/src/components/primitives/Tally.vue -->
<template>
  <div
    class="tally d-flex flex-wrap"
    role="img"
    :aria-label="label"
  >
    <span
      v-for="(cell, i) in painted"
      :key="i"
      class="tally__cell"
      :style="cell.style"
      :title="cell.title"
    />
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'

// One cell per outcome, in order, so the pattern of failures is visible. Tones
// are theme colour names.
const { cells } = defineProps<{
  cells: readonly {
    tone: string
    /**
     * Hover text for the cell. role="img" prunes the subtree, so `label` names
     * the whole strip.
     */
    title?: string
  }[]
  /** The accessible name for the whole strip. */
  label: string
}>()

// Built here as rgb(var(--x)); the slash-alpha form compiles to invalid CSS.
const painted = computed(() => cells.map(cell => ({
  title: cell.title,
  style: { background: `rgb(var(--v-theme-${cell.tone}))` },
})))
</script>

<style scoped>
/* A seam smaller than any spacing step. Both numbers are $tally-* in styles/_config.scss. */
.tally {
  gap: var(--s99ab-tally-gap);
}

/* Small squares, read as a shape. */
.tally__cell {
  width: var(--s99ab-tally-cell);
  height: var(--s99ab-tally-cell);
  border-radius: var(--s99ab-radius);
}
</style>
