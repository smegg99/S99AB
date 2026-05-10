<!-- web/src/components/shell/ThemeToggle.vue -->
<template>
  <!-- Absent when the app pinned the axis. No ripple: the theme change already
       animates the whole screen. -->
  <v-btn
    v-if="!locked"
    :icon="icon"
    :aria-label="label"
    :title="label"
    :ripple="false"
    variant="text"
    size="small"
    @click="toggle"
  />
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { appearanceConfig } from '../../composables/appearance/useAppearance'
import { useThemePreference } from '../../composables/appearance/useThemePreference'
import { useTranslate } from '../../composables/useTranslate'

const locked = computed(() => appearanceConfig().lock !== '')

// Light or dark, remembered through useThemePreference.
const { storageKey = '' } = defineProps<{
  /** Overrides `s99ab.appearance.storageKey` for this button. */
  storageKey?: string
}>()

const { dark, toggle } = useThemePreference(() => storageKey)
const t = useTranslate()

const icon = computed(() => (dark.value ? 'mdi-weather-night' : 'mdi-weather-sunny'))
const label = computed(() => t('common.toggleTheme', 'Toggle theme'))
</script>
