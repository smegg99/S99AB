// web/src/composables/explorer/internal/gridState.ts

// Picks what <UiExplorer> draws: first-load placeholder, grid, or empty state.

import { computed, shallowRef, watch } from 'vue'
import { useDelayed } from '../../useDelay'
import type { ExplorerApi } from '../useExplorer'

/** About a row and a half at the default tile size. */
const FIRST_PLACEHOLDERS = 8

export function useExplorerGridState<T = unknown>(explorer: ExplorerApi<T>) {
  // Paced by s99ab.delay: a fast load shows no placeholder.
  const firstLoad = useDelayed(() => !explorer.initialized.value)

  // As many placeholders as the last load had, so a reload keeps the grid shape.
  const placeholders = shallowRef(FIRST_PLACEHOLDERS)

  const isEmpty = computed(() => explorer.initialized.value && !explorer.children.value.length)
  // A non-root folder always renders the grid: the way back out is a tile.
  const hasGrid = computed(() => !isEmpty.value || explorer.currentId.value !== null)
  // Keyed by folder, so browsing swaps the grid instead of transitioning tiles.
  const gridKey = computed(() => explorer.currentId.value ?? '__root')

  watch(() => explorer.children.value.length, (count) => {
    if (count) placeholders.value = count
  })

  return { firstLoad, placeholders, isEmpty, hasGrid, gridKey }
}
