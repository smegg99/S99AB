<!-- web/src/components/shell/ContrastToggle.vue -->
<template>
  <!-- No ripple: the change already animates the whole screen. -->
  <v-btn
    :icon="icon"
    :aria-label="label"
    :aria-pressed="high"
    :title="label"
    :ripple="false"
    variant="text"
    size="small"
    @click="toggleContrast"
  />
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { useAppearance } from '../../composables/appearance/useAppearance'
import { useTranslate } from '../../composables/useTranslate'

// Normal or high contrast, beside the light/dark button. A real theme swap to
// lightHigh or darkHigh; useAppearance owns both axes.
const { storageKey = '' } = defineProps<{
  /** The light/dark key; contrast uses `<storageKey>.contrast`. Overrides
   *  `s99ab.appearance.storageKey` for this button. */
  storageKey?: string
}>()

const { high, toggleContrast } = useAppearance(() => ({ theme: storageKey }))
const t = useTranslate()

// Filled half-circle for on, outline for off.
const icon = computed(() => (high.value ? 'mdi-circle-half-full' : 'mdi-circle-outline'))

// aria-pressed carries the state, so the label stays the same.
const label = computed(() => t('common.highContrast', 'High contrast'))
</script>
