// web/src/composables/explorer/useExplorerSelection.ts

// Tile selection with desktop file manager rules: click replaces, ctrl toggles,
// shift selects a run from the anchor, ctrl+shift adds the run. Held as ids to survive reloads.

import { inject } from 'vue'
import type { useExplorerSelection } from './internal/selection'
import { explorerSelectionKey } from './internal/selection'

export interface ExplorerPickMods {
  ctrl?: boolean
  shift?: boolean
}

export type ExplorerSelection<T = unknown> = ReturnType<typeof useExplorerSelection<T>>

/** The enclosing selection, or null so a tile knows not to draw the picked state. */
export function useExplorerSelectionContext(): ExplorerSelection | null {
  return inject(explorerSelectionKey, null)
}
