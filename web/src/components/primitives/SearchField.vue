<!-- web/src/components/primitives/SearchField.vue -->
<template>
  <v-text-field
    v-model="model"
    :aria-label="fieldLabel"
    :placeholder="placeholder || fieldLabel"
    class="s99ab-search"
    density="compact"
    variant="outlined"
    prepend-inner-icon="mdi-magnify"
    hide-details
    clearable
    type="search"
  />
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { useTranslate } from '../../composables/useTranslate'

// The search box for a panel head or toolbar. No floating label, since an
// outlined label rides the border in a 44px strip; the name is the aria-label.
const model = defineModel<string | null>({ required: true })

const { label } = defineProps<{
  /** Overrides the layer's "Search". */
  label?: string
  /** An example of what to type; the label is the field's name. */
  placeholder?: string
}>()

const t = useTranslate()
const fieldLabel = computed(() => label ?? t('common.search', 'Search'))
</script>
