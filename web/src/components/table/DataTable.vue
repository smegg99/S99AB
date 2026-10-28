<!-- web/src/components/table/DataTable.vue -->
<template>
  <!-- A named region; the title is the table's accessible name. -->
  <section
    :aria-label="title"
    class="table s99ab-slab"
  >
    <!-- eslint-disable vue/no-mutating-props -- `search` is a ref useServerTable
         owns and hands out to be driven. Writing through it is the contract;
         the prop object itself is never reassigned. -->
    <UiTableStrip
      v-if="hasStrip"
      v-model="table.search.value"
      :busy="busy"
      :placeholder="placeholder"
      :searchable="searchable"
      :title="title"
    >
      <template
        v-if="hasActions"
        #actions
      >
        <slot name="actions" />
      </template>
    </UiTableStrip>
    <!-- eslint-enable vue/no-mutating-props -->

    <!-- One table always: every state renders inside its body, so the headings
         stay and the reserve keeps the height. -->
    <v-data-table-server
      v-bind="table.bind.value"
      :class="{ 's99ab-table--steady': steady }"
      :headers="headers"
      :items-per-page-options="pageSizes"
      :loading="firstLoad"
      :style="steadyStyle"
    >
      <template #loading>
        <UiLoadingState
          :rows="table.bind.value.itemsPerPage"
          variant="skeleton"
          lines="one"
        />
      </template>

      <template #no-data>
        <UiErrorState
          v-if="table.q.error.value"
          :error="table.q.error.value"
          @retry="table.q.refetch()"
        />
        <UiEmptyState
          v-else
          :title="emptyHeading"
          :text="emptyBody"
        />
      </template>

      <!-- Column slots are forwarded; a caller's `loading` or `no-data` slot
           replaces the states above. -->
      <template
        v-for="name in forwardedSlots"
        #[name]="slotProps"
      >
        <slot
          :name="name"
          v-bind="slotProps ?? {}"
        />
      </template>
    </v-data-table-server>
  </section>
</template>

<script setup lang="ts">
import { computed, useSlots } from 'vue'
import UiEmptyState from '../state/EmptyState.vue'
import UiErrorState from '../state/ErrorState.vue'
import UiLoadingState from '../state/LoadingState.vue'
import UiTableStrip from './TableStrip.vue'
import { type DataTableHeader, useTableConfig } from '../../composables/table/useServerTable'
import { type TableLike, useTableFrame } from '../../composables/table/internal/frame'
import { useTranslate } from '../../composables/useTranslate'
import { useForwardedSlots } from '../../composables/primitives/internal/slots'

// Presentation and states. The composable owns the state, so an outside filter
// can drive the table.
const {
  table,
  headers,
  title,
  emptyTitle,
  emptyText,
  perPageOptions,
  steady = true,
  searchable = true,
} = defineProps<{
  table: TableLike
  headers: readonly DataTableHeader[]
  /** Shown in the strip, and the table's accessible name. */
  title?: string
  /** Overrides "Search" for this table. */
  placeholder?: string
  /** Draw the search. Off for a table filtered from outside. */
  searchable?: boolean
  /** Overrides the app config page sizes for this table. */
  perPageOptions?: number[]
  /** Reserve a full page of rows so the footer does not move on the last page. */
  steady?: boolean
  /** Overrides the layer's empty-table wording. */
  emptyTitle?: string
  emptyText?: string
}>()

const slots = useSlots()
const t = useTranslate()
const tableConfig = useTableConfig()
const { firstLoad, busy, reservedRows } = useTableFrame(() => table)

const pageSizes = computed(() => perPageOptions ?? tableConfig.perPageOptions)

const hasActions = computed(() => Boolean(slots.actions))
const hasStrip = computed(() => Boolean(title) || searchable || hasActions.value)

const steadyStyle = computed(() =>
  steady ? { '--s99ab-table-rows': String(reservedRows.value) } : undefined,
)

// `actions` belongs to the strip; `default` would replace the table body.
const forwardedSlots = useForwardedSlots({ except: ['actions', 'default'] })

// Named apart from the prop, or the computed would shadow it.
const emptyHeading = computed(() => emptyTitle ?? t('common.noResults', 'Nothing found'))
const emptyBody = computed(() => emptyText ?? t('common.noResultsHint', 'Try a different search.'))
</script>

<style scoped>
/* Frame, radius and well come from .s99ab-slab. The table stays the
   positioning context for absolutely placed children. */
.table {
  position: relative;
}
</style>
