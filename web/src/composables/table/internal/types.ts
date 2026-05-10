// web/src/composables/table/internal/types.ts
//
// Types for a server-paged table: request, response and app config.

import type { MaybeRefOrGetter } from 'vue'

/** A column, structurally compatible with Vuetify's header type. */
export interface DataTableHeader {
  key: string
  title?: string
  sortable?: boolean
  align?: 'start' | 'center' | 'end'
  width?: number | string
  nowrap?: boolean
}

export interface SortItem {
  key: string
  order?: 'asc' | 'desc'
}

/** One page request. The shape every list endpoint takes. */
export interface TableParams {
  page: number
  limit: number
  sort: string
  search: string
}

/** What a fetcher must return. Total counts the filter, ignoring pagination. */
export interface Page<T> {
  items: T[]
  total: number
}

export type Fetcher<T> = (params: TableParams) => Promise<Page<T>>

/** A query key part; JSON-safe primitives only. */
export type TableKey = readonly (string | number | boolean)[]

export interface ServerTableOptions {
  /**
   * Base query key; every parameter is appended. Use a getter or ref when a
   * filter lives outside the table, so the key changes with it.
   */
  key: MaybeRefOrGetter<TableKey>
  limit?: number
  sort?: SortItem[]
  /** ms. */
  searchDebounce?: number
  /**
   * Mirror page, sort and search in the query string. Off by default for
   * dialogs and desktop shells.
   */
  syncUrl?: boolean
  /** Prefix for two synced tables on one screen, e.g. `?items_page=`. */
  urlPrefix?: string
}

export interface TableRouter {
  query: Record<string, string | undefined>
  replace: (query: Record<string, string | undefined>) => void
}

/** Table defaults from the app's `s99ab.table`, set once by the layer plugin. */
export interface TableConfig {
  /** Rows a page asks for by default. */
  limit: number
  /** ms. */
  searchDebounce: number
  /** Rows an empty table holds open, so its empty state is centred. */
  emptyRows: number
  /** The page sizes the footer offers. */
  perPageOptions: number[]
}
