// web/src/composables/table/useServerTable.ts
//
// Types and defaults live in ./internal and are re-exported here.

import { useQuery } from '@pinia/colada'
import { computed, type Ref, ref, toValue, watch } from 'vue'
import { useDelayed } from '../useDelay'
import { decodeSort, encodeSort, routerFor, tableConfig } from './internal/config'
import type { Page, ServerTableOptions, SortItem, TableParams } from './internal/types'

export * from './internal/types'
export {
  configureTable,
  decodeSort,
  encodeSort,
  registerTableRouter,
  useTableConfig,
} from './internal/config'

export interface TableState {
  page: Ref<number>
  limit: Ref<number>
  sortBy: Ref<SortItem[]>
  search: Ref<string>
  /** Debounced search; this reaches the fetcher. */
  debouncedSearch: Ref<string>
  params: Ref<TableParams>
  reset: () => void
  onOptions: (options: {
    page?: number
    itemsPerPage?: number
    sortBy?: SortItem[]
  }) => void
}

/** Table state and query parameters without fetching, testable without Pinia. */
export function useTableState(options: ServerTableOptions): TableState {
  const router = options.syncUrl ? routerFor() : undefined
  const prefix = options.urlPrefix ? `${options.urlPrefix}_` : ''

  const initial = router?.query ?? {}

  const page = ref(numberFrom(initial[`${prefix}page`], 1))
  const limit = ref(numberFrom(initial[`${prefix}limit`], options.limit ?? tableConfig.limit))
  const sortBy = ref<SortItem[]>(
    initial[`${prefix}sort`]
      ? decodeSort(initial[`${prefix}sort`]!)
      : (options.sort ?? []),
  )
  const search = ref(initial[`${prefix}q`] ?? '')
  const debouncedSearch = ref(search.value)

  let debounceHandle: ReturnType<typeof setTimeout> | undefined

  watch(search, (value) => {
    if (debounceHandle !== undefined) clearTimeout(debounceHandle)
    debounceHandle = setTimeout(() => {
      debouncedSearch.value = value
    }, options.searchDebounce ?? 300)
  })

  // A filter or page-size change resets the page number.
  watch([debouncedSearch, limit], () => {
    page.value = 1
  })
  watch(sortBy, () => {
    page.value = 1
  })

  const params = computed<TableParams>(() => ({
    page: page.value,
    limit: limit.value,
    sort: encodeSort(sortBy.value),
    search: debouncedSearch.value,
  }))

  if (router) {
    watch(params, (p) => {
      router.replace({
        ...router.query,
        // Defaults are omitted, so a pristine table leaves a clean URL.
        [`${prefix}page`]: p.page === 1 ? undefined : String(p.page),
        [`${prefix}limit`]:
          p.limit === (options.limit ?? tableConfig.limit) ? undefined : String(p.limit),
        [`${prefix}sort`]: p.sort || undefined,
        [`${prefix}q`]: p.search || undefined,
      })
    })
  }

  function reset() {
    page.value = 1
    limit.value = options.limit ?? 25
    sortBy.value = options.sort ?? []
    search.value = ''
    debouncedSearch.value = ''
  }

  // Vuetify emits page, itemsPerPage and sortBy in one payload.
  function onOptions(next: {
    page?: number
    itemsPerPage?: number
    sortBy?: SortItem[]
  }) {
    if (next.sortBy && encodeSort(next.sortBy) !== encodeSort(sortBy.value)) {
      sortBy.value = next.sortBy
    }
    if (next.itemsPerPage !== undefined && next.itemsPerPage !== limit.value) {
      limit.value = next.itemsPerPage
    }
    // Applied last: a sort or size change already reset the page, and the
    // payload still carries the old page.
    if (next.page !== undefined && next.page !== page.value) {
      page.value = next.page
    }
  }

  return {
    page,
    limit,
    sortBy,
    search,
    debouncedSearch,
    params,
    reset,
    onOptions,
  }
}

function numberFrom(raw: string | undefined, fallback: number): number {
  const n = Number(raw)
  // An unparseable value falls back to the default, so stale bookmarks work.
  return Number.isFinite(n) && n > 0 ? Math.floor(n) : fallback
}

/** The props v-data-table-server is bound to, declared so a v-bind spread stays typechecked. */
export interface TableBind {
  'items': unknown[]
  'itemsLength': number
  'itemsPerPage': number
  'page': number
  'sortBy': SortItem[]
  'search': string
  'loading': boolean
  'onUpdate:options': (options: {
    page?: number
    itemsPerPage?: number
    sortBy?: SortItem[]
  }) => void
}

/**
 * State, query and the `bind` props for v-data-table-server. `P` is inferred
 * from the fetcher, so extra response fields survive in `q.data`.
 */
export function useServerTable<T = unknown, P extends Page<T> = Page<T>>(
  fetcher: (params: TableParams) => Promise<P>,
  options: ServerTableOptions,
) {
  const state = useTableState(options)

  const q = useQuery({
    // Every parameter is in the key, so Colada caches per view; toValue re-keys
    // when an outside filter changes.
    key: () => [...toValue(options.key), state.params.value],
    query: () => fetcher(state.params.value),
    // Keep the previous page on screen while the next loads.
    placeholderData: previous => previous,
  })

  // Paced like other busy states, so a cached page does not flash the progress bar.
  const loading = useDelayed(() => q.asyncStatus.value === 'loading')

  const bind = computed<TableBind>(() => ({
    'items': (q.data.value?.items ?? []) as unknown[],
    'itemsLength': q.data.value?.total ?? 0,
    'itemsPerPage': state.limit.value,
    'page': state.page.value,
    'sortBy': state.sortBy.value,
    'search': state.debouncedSearch.value,
    'loading': loading.value,
    'onUpdate:options': state.onOptions,
  }))

  return { ...state, q, bind }
}
