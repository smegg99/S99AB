<!-- web/src/components/primitives/Thumb.vue -->
<template>
  <v-img
    class="thumb"
    :src="src"
    :width="size"
    :height="size"
    :alt="alt"
    cover
  />
</template>

<script setup lang="ts">
// A framed preview, square by default. v-img has no border of its own.
const { size = 120 } = defineProps<{
  src: string
  /** Required, so the preview has an accessible name. */
  alt: string
  size?: number | string
}>()
</script>

<style scoped>
/* The frame in theme tokens; v-img's `rounded` uses Vuetify's radius. */
.thumb {
  flex: 0 0 auto;
  border: 1px solid rgb(var(--v-theme-lineSoft));
  border-radius: var(--s99ab-radius);
}
</style>
