// web/src/composables/table/internal/config.ts
//
// App-wide table defaults, the injected router, and conversion between
// Vuetify's sortBy and the contract's `-field,field`.

import type { SortItem, TableConfig, TableRouter } from './types'

export const tableConfig: TableConfig = {
  limit: 25,
  searchDebounce: 300,
  emptyRows: 6,
  perPageOptions: [10, 25, 50, 100],
}

export function configureTable(patch: Partial<TableConfig>) {
  Object.assign(tableConfig, patch)
}

/** Read-only view of the table config. */
export function useTableConfig(): Readonly<TableConfig> {
  return tableConfig
}

let routerFactory: (() => TableRouter | undefined) | undefined

/** Installed by the layer plugin, so tables do not import vue-router. */
export function registerTableRouter(factory: () => TableRouter | undefined) {
  routerFactory = factory
}

/** Vuetify's sortBy to the `-field,field` the contract specifies. */
export function encodeSort(sortBy: SortItem[]): string {
  return sortBy.map(s => (s.order === 'desc' ? '-' : '') + s.key).join(',')
}

export function decodeSort(sort: string): SortItem[] {
  return sort
    .split(',')
    .map(s => s.trim())
    .filter(Boolean)
    .map(s =>
      s.startsWith('-')
        ? { key: s.slice(1), order: 'desc' as const }
        : { key: s, order: 'asc' as const },
    )
}

/** The registered router, or undefined in a shell without one. */
export function routerFor(): TableRouter | undefined {
  return routerFactory?.()
}
