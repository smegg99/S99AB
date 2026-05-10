<!-- web/src/components/explorer/ExplorerGlyphs.vue -->
<template>
  <div>
    <v-label
      :text="label"
      class="text-caption mb-2"
    />

    <div
      :aria-label="label"
      class="s99ab-swatches"
      role="radiogroup"
    >
      <v-btn
        v-for="option in choices"
        :key="option || 'default'"
        :aria-label="option || defaultLabel"
        :aria-checked="model === option"
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

// The icon row in the folder dialog. Takes icon names from the app's icon set.
const { options } = defineProps<{
  label: string
  options: readonly string[]
  /** Drawn for the '' choice: the folder's default icon. */
  fallback: string
  defaultLabel: string
}>()

const model = defineModel<string>({ required: true })

// '' first, so the default icon is an explicit choice.
const choices = computed(() => ['', ...options])
</script>
