<!-- web/src/components/table/TableStrip.vue -->
<template>
  <div class="table__top">
    <span
      v-if="title"
      class="s99ab-eyebrow table__title"
    >{{ title }}</span>

    <div
      v-if="searchable"
      class="table__search"
    >
      <v-icon
        class="table__magnifier"
        icon="mdi-magnify"
        size="17"
      />

      <!-- A native input, since every Vuetify field draws a box. The name is
           the aria-label; the placeholder repeats it so the field is visible. -->
      <input
        v-model="model"
        :aria-label="searchLabel"
        :placeholder="placeholder ?? searchLabel"
        class="table__input"
        type="text"
      >

      <!-- Only when there is something to clear. -->
      <v-btn
        v-if="model"
        :aria-label="clearLabel"
        :title="clearLabel"
        icon="mdi-close"
        size="x-small"
        variant="text"
        @click="clear"
      />
    </div>

    <div
      v-if="$slots.actions"
      class="s99ab-controls"
    >
      <slot name="actions" />
    </div>

    <!-- On the strip's bottom edge, so nothing moves while a search runs. -->
    <v-progress-linear
      v-if="busy"
      class="table__progress"
      color="accent"
      height="2"
      indeterminate
    />
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { useTranslate } from '../../composables/useTranslate'

// The strip itself is the search field, with no box of its own.
const { searchable = true, busy = false } = defineProps<{
  /** Shown in the strip, in the label style. */
  title?: string
  /** Defaults to the field's own name. */
  placeholder?: string
  searchable?: boolean
  /** A request is in flight, shown on the strip's bottom edge. */
  busy?: boolean
}>()

const model = defineModel<string>({ required: true })

const t = useTranslate()

const searchLabel = computed(() => t('common.search', 'Search'))
const clearLabel = computed(() => t('common.clear', 'Clear'))

function clear() {
  model.value = ''
}
</script>

<style scoped>
.table__top {
  position: relative;
  display: flex;
  align-items: stretch;
  min-height: var(--s99ab-strip-h);
  background: rgb(var(--v-theme-chrome2));
  border-bottom: 1px solid rgb(var(--v-theme-line));
}

.table__title {
  display: flex;
  flex: 0 0 auto;
  align-items: center;
  padding-inline: var(--s99ab-strip-pad-x);
}

/* A hairline between title and search, like a segmented control's seam. */
.table__title + .table__search {
  border-inline-start: 1px solid rgb(var(--v-theme-line));
}

.table__search {
  display: flex;
  flex: 1 1 auto;
  align-items: center;
  gap: var(--s99ab-control-gap);
  min-width: 0;
  padding-inline: var(--s99ab-strip-pad-x);
}

/* Focus tints the region and the magnifier takes the accent. */
.table__search:focus-within {
  background: rgba(var(--v-theme-accent), 0.06);
}

.table__search:focus-within .table__magnifier {
  color: rgb(var(--v-theme-accent));
}

.table__magnifier {
  flex: 0 0 auto;
  color: rgb(var(--v-theme-ink3));
}

.table__progress {
  position: absolute;
  bottom: -1px;
  left: 0;
}

.table__input {
  flex: 1 1 auto;
  min-width: 0;
  border: 0;
  background: none;
  color: rgb(var(--v-theme-ink));
  font: inherit;
  outline: none;
}

.table__input::placeholder {
  color: rgb(var(--v-theme-ink3));
}

/* Hides Chrome's own clear button on type=search. */
.table__input::-webkit-search-cancel-button {
  display: none;
}
</style>
