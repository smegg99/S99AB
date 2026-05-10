<!-- web/src/components/shell/TransitionPicker.vue -->
<template>
  <v-select
    v-model="current"
    :items="items"
    :label="label"
    density="compact"
    hide-details
    variant="outlined"
    class="s99ab-transition-picker"
  />
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { useThemeTransition } from '../../composables/appearance/useThemeTransition'
import { useTranslate } from '../../composables/useTranslate'

/** The user's remembered appearance-change shape, as a select. */
const t = useTranslate()
const { current, options } = useThemeTransition()

// Locale keys are camelCase: `sweep-start` maps to `sweepStart`.
function keyFor(value: string): string {
  return value.replace(/-([a-z])/g, (_, letter: string) => letter.toUpperCase())
}

// Layer defaults, so an app without these locale keys still shows words.
const fallbacks: Record<string, string> = {
  'circle': 'Circle out',
  'circle-in': 'Circle in',
  'sweep': 'Sweep down',
  'sweep-up': 'Sweep up',
  'sweep-start': 'Sweep from start',
  'sweep-end': 'Sweep from end',
  'split': 'Split',
  'fade': 'Fade',
  'none': 'None',
}

const items = computed(() => options.map(value => ({
  value,
  title: t(`transition.${keyFor(value)}`, fallbacks[value] ?? value),
})))

const label = computed(() => t('transition.label', 'Theme transition'))
</script>
