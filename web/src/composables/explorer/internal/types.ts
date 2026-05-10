// web/src/composables/explorer/internal/types.ts
//
// What an app hands the explorer. The methods a source implements set the features;
// load() alone gives a read-only tree.

import type {
  ExplorerBehaviour,
  ExplorerIcons,
  ExplorerTileStyle,
} from '../useExplorerConfig'
import type { ExplorerKind, ExplorerNode, ExplorerOrder } from '../useExplorerTree'

/** One reposition. `index` is the slot among the destination's children. */
export interface ExplorerMove {
  kind: ExplorerKind
  id: string
  parentId: string | null
  index: number
}

export interface ExplorerFolderInput {
  name: string
  /** '' for the default tint, else an accent name the CSS declares. */
  accent: string
  parentId: string | null
  /** Sent only when enabled in s99ab.explorer.folderFields. */
  icon?: string
  image?: string
}

export interface ExplorerSource<T = unknown> {
  /** The whole tree, flat; ancestors are needed for the path and depth cap. */
  load: () => Promise<ExplorerNode<T>[]>
  move?: (move: ExplorerMove) => Promise<void>
  createFolder?: (input: ExplorerFolderInput) => Promise<void>
  renameFolder?: (id: string, input: ExplorerFolderInput) => Promise<void>
  /** Without recursive, the app decides what happens to the contents. */
  deleteFolder?: (id: string, recursive: boolean) => Promise<void>
  /** Keeps a node at the front of its folder; the menu wording comes from s99ab.explorer.pin. */
  pin?: (id: string, pinned: boolean) => Promise<void>
}

export interface ExplorerOptions<T = unknown> extends ExplorerOrder<T> {
  /** Caches the instance under this key, keeping the open folder across screen visits. */
  key?: string
  maxDepth?: number
  icons?: Partial<ExplorerIcons>
  /** Per-instance override of s99ab.explorer.tile. */
  tile?: Partial<ExplorerTileStyle>
  behaviour?: Partial<ExplorerBehaviour>
}
