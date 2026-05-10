<!-- web/src/components/primitives/Stack.vue -->
<template>
  <div :class="classes">
    <slot />
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'

/** Children stacked, separated by a spacing role from styles/_config.scss. */
const { gap = 'gap' } = defineProps<{
  /**
   * `gap` between panels or fields, `tight` inside a strip, `control` between
   * two controls. No numeric option: add a role instead.
   */
  gap?: 'gap' | 'tight' | 'control'
}>()

const classes = computed(() => ['s99ab-stack', `s99ab-stack--${gap}`])
</script>
