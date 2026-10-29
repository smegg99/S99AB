<!-- web/src/components/explorer/ExplorerSwatches.vue -->
<template>
  <div>
    <v-label
      :text="label"
      class="s99ab-swatches__label"
    />

    <!-- The group carries the name and the chosen tint for screen readers. -->
    <div
      :aria-label="label"
      class="s99ab-swatches"
      role="radiogroup"
      @keydown="onKeydown"
    >
      <v-btn
        v-for="option in options"
        :key="option || 'default'"
        :aria-label="option ? nameOf(option) : defaultLabel"
        :aria-checked="model === option"
        :tabindex="tabindexOf(option)"
        :data-accent="option || undefined"
        :class="{ 's99ab-swatch--active': model === option }"
        class="s99ab-swatch"
        icon
        size="small"
        variant="flat"
        role="radio"
        @click="model = option"
      />
    </div>
  </div>
</template>

<script setup lang="ts">
import { useRadioKeys } from '../../composables/primitives/internal/radio'

// The tint row in the folder dialog.
const { options, nameOf = (option: string) => option } = defineProps<{
  label: string
  /** '' first: the default tint is an explicit choice. */
  options: readonly string[]
  /** Label for ''. */
  defaultLabel: string
  /** A tint's localized name; the tint itself when the app gives none. */
  nameOf?: (option: string) => string
}>()

const model = defineModel<string>({ required: true })

const { tabindexOf, onKeydown } = useRadioKeys(() => options, model)
</script>
