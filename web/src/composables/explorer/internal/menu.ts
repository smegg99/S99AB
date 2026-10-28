// web/src/composables/explorer/internal/menu.ts

// State and labels for the <UiExplorer> tile context menu; tiles reach it through injected actions.

import { computed, shallowRef, watch } from 'vue'
import { tileById } from '../../../browser/tiles'
import { provideExplorerActions } from './actions'
import type { ExplorerNode } from './tree'
import { useTranslate } from '../../useTranslate'

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
  /** The explorer's element; focus returns to the menu's tile inside it on close. */
  root?: () => HTMLElement | null
  /** The open menu's element, which is teleported out of the explorer. */
  content?: () => HTMLElement | undefined
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

  // Capture phase on the explorer: while the activator-less menu is open, up and down
  // enter it, Escape closes it, and the grid gets no keys.
  function onKeydown(event: KeyboardEvent) {
    if (!menuOpen.value || event.isComposing) return
    const items = () => [...host.content?.()?.querySelectorAll<HTMLElement>('.v-list-item[tabindex]:not(.v-list-item--disabled)') ?? []]
    if (event.key === 'ArrowDown') items()[0]?.focus()
    if (event.key === 'ArrowUp') items().at(-1)?.focus()
    if (event.key === 'Escape') menuOpen.value = false
    event.preventDefault()
    event.stopPropagation()
  }

  // On close, focus returns to the menu's tile unless an entry moved it (a field, a dialog).
  watch(menuOpen, (open) => {
    const id = menuNode.value?.id
    const active = document.activeElement
    const kept = active && active !== document.body && !host.content?.()?.contains(active)
    if (open || id === undefined || kept) return
    const root = host.root?.()
    if (root) tileById(root, id)?.focus()
  }, { flush: 'post' })

  return {
    onKeydown,
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
