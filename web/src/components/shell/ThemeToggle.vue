<!-- web/src/components/shell/ThemeToggle.vue -->
<template>
  <!-- Absent when the app pinned the axis. No ripple: the theme change already
       animates the whole screen. -->
  <v-btn
    v-if="!locked"
    icon
    :aria-label="label"
    :aria-pressed="dark"
    :ripple="false"
    variant="text"
    size="small"
    @click="toggle"
  >
    <v-icon :icon="icon" />
    <v-tooltip
      :text="label"
      activator="parent"
      location="bottom"
    />
  </v-btn>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { appearanceConfig } from '../../composables/appearance/internal/appearance'
import { useThemePreference } from '../../composables/appearance/useThemePreference'
import { useTranslate } from '../../composables/useTranslate'

// Light or dark, remembered through useThemePreference.
const { storageKey = '' } = defineProps<{
  /** Overrides `s99ab.appearance.storageKey` for this button. */
  storageKey?: string
}>()

const locked = computed(() => appearanceConfig().lock !== '')

const { dark, toggle } = useThemePreference(() => storageKey)
const t = useTranslate()

const icon = computed(() => (dark.value ? 'mdi-weather-night' : 'mdi-weather-sunny'))
const label = computed(() => t('common.darkTheme', 'Dark theme'))
</script>
