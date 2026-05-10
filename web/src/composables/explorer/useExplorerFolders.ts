// web/src/composables/explorer/useExplorerFolders.ts

// Folder dialogs (new, rename, delete) shared by the toolbar and context menu.
// Kept out of useExplorer so that composable imports no components.

import ExplorerFolderDialog from '../../components/explorer/ExplorerFolderDialog.vue'
import type { ExplorerApi } from './useExplorer'
import type { ExplorerNode } from './useExplorerTree'
import { useDialog } from '../useDialog'
import { useTranslate } from '../useTranslate'

export interface ExplorerFolderDraft {
  name: string
  accent: string
  /** Present only when enabled in folderFields. */
  icon?: string
  image?: string
}

export function useExplorerFolders<T = unknown>(explorer: ExplorerApi<T>) {
  const { openDialog, confirm } = useDialog()
  const t = useTranslate()

  // Failures are reported through explorer.actionError; swallow the rejection.
  async function attempt(action: () => Promise<void>) {
    try {
      await action()
    }
    catch {
      // reported through explorer.actionError
    }
  }

  // The title doubles as the label: the host binds the accessible name from outside.
  async function create(parentId: string | null = explorer.currentId.value) {
    const title = t('explorer.newFolder', 'New folder')
    const draft = await openDialog<ExplorerFolderDraft>(ExplorerFolderDialog, {
      title,
    }, { width: 'sm', label: title })
    if (!draft) return
    await attempt(() => explorer.createFolder({ ...draft, parentId }))
  }

  async function rename(node: ExplorerNode<T>) {
    const title = t('explorer.renameFolder', 'Rename folder')
    const draft = await openDialog<ExplorerFolderDraft>(ExplorerFolderDialog, {
      title,
      name: node.name,
      accent: node.accent ?? '',
      icon: node.icon ?? '',
      image: node.image ?? '',
    }, { width: 'sm', label: title })
    if (!draft) return
    await attempt(() => explorer.renameFolder(node.id, { ...draft, parentId: node.parentId }))
  }

  /** Confirms first; recursive also deletes the contents. */
  async function remove(node: ExplorerNode<T>, recursive = false) {
    const ok = await confirm({
      title: recursive
        ? t('explorer.confirmDeleteAll', 'Delete this folder and everything in it?')
        : t('explorer.confirmDelete', 'Delete this folder?'),
      body: node.name,
      confirmColor: 'error',
    })
    if (!ok) return
    await attempt(() => explorer.deleteFolder(node.id, recursive))
  }

  return { create, rename, remove }
}
