<!-- web/src/components/primitives/ToolGroup.vue -->
<template>
  <div
    :aria-label="label"
    class="group"
    role="group"
  >
    <UiToolKey
      v-for="item in items"
      :key="String(item.value)"
      :label="item.label"
      :icon="item.icon"
      :title="item.title"
      :active="item.value === model"
      :disabled="disabled"
      @click="(event) => onKey(item.value, event)"
    />
  </div>
</template>

<script setup lang="ts">
import UiToolKey from './ToolKey.vue'
import type { ToolItem } from '../../types'

// A segmented control with one choice always set, for a few options that should
// stay visible. Keys share borders, which v-btn-toggle cannot do.
const { items, label, disabled } = defineProps<{
  items: readonly ToolItem[]
  /** The group's accessible name. */
  label?: string
  disabled?: boolean
}>()

// `select` carries the press event alongside the model update, for a reveal
// that opens at the cursor.
const emit = defineEmits<{ select: [value: string | number | boolean, event: MouseEvent] }>()

const model = defineModel<string | number | boolean>({ required: true })

function onKey(value: string | number | boolean, event: MouseEvent) {
  model.value = value
  emit('select', value, event)
}
</script>

<style scoped>
/* The seam rules only apply to this pairing, so they stay scoped. */
.group {
  display: inline-flex;
  flex: 0 0 auto;
}

/* Keys share their borders, so the run reads as one control. */
.group :deep(.key) {
  border-radius: 0;
}

.group :deep(.key:first-child) {
  border-start-start-radius: var(--s99ab-radius);
  border-end-start-radius: var(--s99ab-radius);
}

.group :deep(.key:last-child) {
  border-start-end-radius: var(--s99ab-radius);
  border-end-end-radius: var(--s99ab-radius);
}

.group :deep(.key + .key) {
  margin-inline-start: -1px;
}

/* The pressed face covers its neighbour's border so the seam does not double. */
.group :deep(.key--active) {
  position: relative;
  z-index: 1;
}
</style>
