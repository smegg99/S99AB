<!-- web/src/components/primitives/Filter.vue -->
<template>
  <!-- The search field of a pane, drawer list or section head. Not
       type="search", which hangs WebKitGTK 2.52. -->
  <v-text-field
    ref="field"
    class="s99ab-filter"
    :model-value="shown"
    :placeholder="label"
    :aria-label="label"
    prepend-inner-icon="mdi-magnify"
    hide-details
    clearable
    @update:model-value="typed"
    @keydown.down.prevent="emit('down')"
    @keydown.enter.prevent="emit('enter')"
    @keydown.esc="escape"
  />
</template>

<script setup lang="ts">
import { onScopeDispose, ref, useTemplateRef, watch } from 'vue'
import { debounced } from '../../browser/time'

const { modelValue = '', label, debounce = 0 } = defineProps<{
  modelValue?: string
  /** Its placeholder and accessible name, such as "Szukaj oddziału". */
  label: string
  /** Milliseconds after the last key before the words reach the caller; 0 at once. */
  debounce?: number
}>()

const emit = defineEmits<{
  'update:modelValue': [text: string]
  /** Down in the field: into the rows under it. */
  'down': []
  /** Enter in the field: the first row picked. */
  'enter': []
  /** Escape in the field, after it emptied itself. */
  'escape': []
}>()

/** What the field shows: the caller's words, or what is typed while it waits out the debounce. */
const shown = ref(modelValue)
watch(() => modelValue, (value) => {
  shown.value = value
})

function send(text: string) {
  later.cancel()
  if (text !== modelValue) emit('update:modelValue', text)
}
const later = debounced(send, () => debounce)
onScopeDispose(later.cancel)

function typed(value: string | null) {
  const text = value ?? ''
  shown.value = text
  if (!debounce || !text) send(text)
  else later.run(text)
}

function escape() {
  if (shown.value) typed('')
  emit('escape')
}

const field = useTemplateRef<{ focus: () => void, $el: HTMLElement }>('field')

defineExpose({
  /** Moves the focus into the field. */
  focus: () => field.value?.focus(),
  /** Focuses the field with its words selected (Ctrl+F). */
  select: () => {
    field.value?.focus()
    field.value?.$el.querySelector('input')?.select()
  },
})
</script>

<style scoped>
/* 26px dense height; the magnify glyph at 16px instead of the field's 24px. */
.s99ab-filter {
  --s99ab-control-h: var(--s99ab-control-h-dense);
}

.s99ab-filter :deep(.v-field) {
  --v-input-padding-top: 1px;
  --v-field-padding-bottom: 1px;
}

.s99ab-filter :deep(.v-field__prepend-inner .v-icon) { font-size: 16px; }
</style>
