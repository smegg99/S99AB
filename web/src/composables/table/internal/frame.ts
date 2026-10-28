// web/src/composables/table/internal/frame.ts

import { computed, type Ref } from 'vue'
import type { QueryLike } from '../../state/useAsyncState'
import { useDelayed } from '../../useDelay'
import { type TableBind, useTableConfig } from '../useServerTable'

/** The part of useServerTable's return a table frame reads, typed structurally. */
export interface TableLike {
  q: QueryLike & { refetch: () => unknown }
  bind: Ref<TableBind>
  search: Ref<string>
}

/**
 * A table frame's derived state: skeleton, catching-up flag and row reserve.
 * Takes a getter, since a screen may rebuild useServerTable.
 */
export function useTableFrame(table: () => TableLike) {
  const config = useTableConfig()

  // Only the first load; later searches keep the current rows.
  const firstLoad = useDelayed(() => {
    const { q } = table()
    return q.asyncStatus.value === 'loading' && q.data.value === undefined
  })

  // A refetch with rows on screen.
  const busy = useDelayed(
    () => table().q.asyncStatus.value === 'loading' && !firstLoad.value,
  )

  /**
   * Rows the reserve holds open: the page size, capped at the total so it never
   * reserves rows the table cannot have and stays fixed across pages.
   */
  const reservedRows = computed(() => {
    const bind = table().bind.value
    return Math.min(
      bind.itemsPerPage,
      Math.max(bind.itemsLength, config.emptyRows),
    )
  })

  return { firstLoad, busy, reservedRows }
}
