// web/src/explorer.ts
//
// Explorer tree helpers and event wiring for code outside setup: `@smegg99/s99ab/explorer`.

export {
  canMoveInto,
  childrenOf,
  depthOf,
  groupByParent,
  indexById,
  isDescendant,
  pathOf,
  subtreeHeight,
} from './composables/explorer/internal/tree'
export { bindExplorerEvents } from './composables/explorer/internal/events'
export type {
  ExplorerFolderInput,
  ExplorerMove,
  ExplorerOptions,
  ExplorerSource,
} from './composables/explorer/internal/types'
export { applyExplorerTints, configureExplorer } from './composables/explorer/internal/config'
export { accentTriplet } from './composables/explorer/internal/accents'
