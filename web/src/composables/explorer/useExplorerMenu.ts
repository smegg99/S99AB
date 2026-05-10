// web/src/composables/explorer/useExplorerMenu.ts

// State and labels for the <UiExplorer> tile context menu; tiles reach it through injected actions.

import { computed, shallowRef } from 'vue'
import { provideExplorerActions } from './useExplorerNode'
import type { ExplorerNode } from './useExplorerTree'
import { useTranslate } from '../useTranslate'

export interface ExplorerMenuHost<T> {
  open: (node: ExplorerNode<T>) => void
  /** Called after the menu opens. */
  menu?: (node: ExplorerNode<T>, event: MouseEvent) => void
  /** Whether the source implements the built-in folder entries. */
  canEdit: () => boolean
  canPin: () => boolean
  /** Whether the screen filled the menu slot. */
  hasSlot: () => boolean
  /** The app's pin wording; empty strings use the layer's. */
  pinWords: () => { add: string, remove: string }
  /** External file drop; absent ignores it. */
  files?: (parentId: string | null, files: File[]) => void
}

export function useExplorerMenu<T = unknown>(host: ExplorerMenuHost<T>) {
  const t = useTranslate()

  const menuOpen = shallowRef(false)
  const menuAt = shallowRef<[number, number]>([0, 0])
  // shallow, so the payload type survives: a deep ref would unwrap T.
  const menuNode = shallowRef<ExplorerNode<T> | null>(null)

  const renameLabel = computed(() => t('explorer.renameFolder', 'Rename folder'))
  const deleteLabel = computed(() => t('explorer.deleteFolder', 'Delete folder'))
  const deleteAllLabel = computed(() => t('explorer.deleteFolderAll', 'Delete with contents'))
  // The app's own wording wins over the layer's translation.
  const pinLabel = computed(() => host.pinWords().add || t('explorer.pin', 'Pin'))
  const unpinLabel = computed(() => host.pinWords().remove || t('explorer.unpin', 'Unpin'))

  // Tiles inject the explorer untyped; this contract supplies T.
  provideExplorerActions<T>({
    open: host.open,
    menu: (node, event) => {
      menuNode.value = node
      menuAt.value = [event.clientX, event.clientY]
      menuOpen.value = true
      host.menu?.(node, event)
    },
    // A leaf gets a menu when the screen filled the slot or the source can pin.
    canMenu: node => (node.kind === 'folder' ? host.canEdit() : host.hasSlot() || host.canPin()),
    files: host.files,
  })

  return {
    menuOpen,
    menuAt,
    menuNode,
    renameLabel,
    deleteLabel,
    deleteAllLabel,
    pinLabel,
    unpinLabel,
  }
}
