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
    >
      <v-btn
        v-for="option in options"
        :key="option || 'default'"
        :aria-label="option || defaultLabel"
        :aria-checked="model === option"
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
// The tint row in the folder dialog.
defineProps<{
  label: string
  /** '' first: the default tint is an explicit choice. */
  options: readonly string[]
  /** Label for ''. */
  defaultLabel: string
}>()

const model = defineModel<string>({ required: true })
</script>
