<!-- web/src/components/explorer/ExplorerGlyphs.vue -->
<template>
  <div>
    <v-label
      :text="label"
      class="s99ab-swatches__label"
    />

    <div
      :aria-label="label"
      class="s99ab-swatches"
      role="radiogroup"
      @keydown="onKeydown"
    >
      <v-btn
        v-for="option in choices"
        :key="option || 'default'"
        :aria-label="option ? nameOf(option) : defaultLabel"
        :aria-checked="model === option"
        :tabindex="tabindexOf(option)"
        :icon="option || fallback"
        :class="{ 's99ab-swatch--active': model === option }"
        class="s99ab-glyph"
        variant="text"
        size="small"
        role="radio"
        @click="model = option"
      />
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { useRadioKeys } from '../../composables/primitives/internal/radio'

// The icon row in the folder dialog. Takes icon names from the app's icon set.
const { options, nameOf = (option: string) => option } = defineProps<{
  label: string
  options: readonly string[]
  /** Drawn for the '' choice: the folder's default icon. */
  fallback: string
  defaultLabel: string
  /** An icon's localized name; the icon name itself when the app gives none. */
  nameOf?: (option: string) => string
}>()

const model = defineModel<string>({ required: true })

// '' first, so the default icon is an explicit choice.
const choices = computed(() => ['', ...options])
const { tabindexOf, onKeydown } = useRadioKeys(() => choices.value, model)
</script>
