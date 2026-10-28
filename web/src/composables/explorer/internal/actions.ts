// web/src/composables/explorer/internal/actions.ts

import { inject, type InjectionKey, provide } from 'vue'
import type { ExplorerActions } from '../useExplorerNode'

export const explorerActionsKey: InjectionKey<ExplorerActions> = Symbol(
  's99ab:explorer-actions',
)

export function provideExplorerActions<T>(actions: ExplorerActions<T>) {
  provide(explorerActionsKey, actions as ExplorerActions)
}

export const noActions: ExplorerActions = { open: () => {}, menu: () => {} }

export function useExplorerActions(): ExplorerActions {
  return inject(explorerActionsKey, noActions)
}

/** Whether a drag carries external files. */
export function dragHasFiles(event: DragEvent): boolean {
  return !!event.dataTransfer?.types.includes('Files')
}
