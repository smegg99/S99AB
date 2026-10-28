// web/src/composables/explorer/useExplorer.ts

// File-manager explorer over an app-supplied tree source: one folder at a time,
// drag to reorder or file, breadcrumbs back out.

import { computed, inject, provide, ref, shallowRef } from 'vue'
import { explorerDefaults } from './internal/config'
import { createExplorerDrag } from './internal/drag'
import { createExplorerEvents } from './internal/events'
import {
  canMoveInto,
  type ExplorerNode,
  type ExplorerOrder,
  groupByParent,
  pathOf,
  byFoldersFirst,
} from './internal/tree'
import { explorerKey } from './internal/context'
import type {
  ExplorerFolderInput,
  ExplorerOptions,
  ExplorerSource,
} from './internal/types'
import type { ExplorerBehaviour, ExplorerIcons, ExplorerTileStyle } from './useExplorerConfig'

export type { ExplorerFolderInput, ExplorerMove, ExplorerOptions, ExplorerSource } from './internal/types'

function createExplorer<T = unknown>(
  source: ExplorerSource<T>,
  options: ExplorerOptions<T> = {},
) {
  const config = explorerDefaults()

  // Resolved on read, so runtime changes to s99ab.explorer apply to existing instances.
  const ordering = computed<ExplorerOrder<T>>(() => ({
    foldersFirst: options.foldersFirst ?? config.foldersFirst,
    sort: options.sort,
  }))
  const maxDepth = computed(() => options.maxDepth ?? config.maxDepth)
  const icons = computed<ExplorerIcons>(() => ({ ...config.icons, ...options.icons }))
  const tile = computed<ExplorerTileStyle>(() => ({ ...config.tile, ...options.tile }))
  const behaviour = computed<ExplorerBehaviour>(
    () => ({ ...config.behaviour, ...options.behaviour }),
  )

  const events = createExplorerEvents<T>()

  const nodes = shallowRef<ExplorerNode<T>[]>([])
  const currentId = ref<string | null>(null)
  /** Unsaved order a drag is showing; null uses the tree's own order. */
  const preview = shallowRef<ExplorerNode<T>[] | null>(null)
  const loading = ref(false)
  const initialized = ref(false)
  /** Last load failure; the grid shows a retry. */
  const error = shallowRef<unknown>(null)
  /** Last move or folder action failure, shown as a toast. */
  const actionError = shallowRef<unknown>(null)

  const groups = computed(() => groupByParent(nodes.value, ordering.value))
  const path = computed(() => pathOf(nodes.value, currentId.value))
  const current = computed(() => path.value[path.value.length - 1] ?? null)
  const children = computed(
    () => preview.value ?? groups.value.get(currentId.value) ?? [],
  )

  const can = computed(() => ({
    move: typeof source.move === 'function',
    create: typeof source.createFolder === 'function',
    rename: typeof source.renameFolder === 'function',
    remove: typeof source.deleteFolder === 'function',
    pin: typeof source.pin === 'function',
  }))

  function countOf(parentId: string | null): number {
    return groups.value.get(parentId)?.length ?? 0
  }

  /** Whether a node may be dropped into a container, by the layer's rules and the source's. */
  function canMoveNode(node: ExplorerNode<T>, parentId: string | null): boolean {
    return can.value.move
      && canMoveInto(nodes.value, node, parentId, maxDepth.value)
      && (source.canMove?.(node, parentId) ?? true)
  }

  /** Whether a node can be picked up at all: dropped back where it sits. */
  function canDrag(node: ExplorerNode<T>): boolean {
    return can.value.move && !node.disabled
      && (source.canMove?.(node, node.parentId ?? null) ?? true)
  }

  function navigate(id: string | null) {
    if (currentId.value === id) return
    currentId.value = id
    preview.value = null
    events.emit('navigate', id, current.value)
  }

  function up() {
    navigate(current.value?.parentId ?? null)
  }

  /** Whether a folder may be created in a container within maxDepth. */
  function canCreateIn(parentId: string | null): boolean {
    return can.value.create && pathOf(nodes.value, parentId).length < maxDepth.value
  }

  async function refresh() {
    loading.value = true
    error.value = null
    // Ancestors to fall back to if the open folder is gone after the reload.
    const ancestors = path.value.slice(0, -1).map(n => n.id)
    const was = currentId.value
    try {
      nodes.value = await source.load()
      preview.value = null
      if (
        currentId.value
        && !nodes.value.some(n => n.id === currentId.value)
      ) {
        currentId.value
          = [...ancestors]
            .reverse()
            .find(id => nodes.value.some(n => n.id === id)) ?? null
      }
      // The open folder was deleted elsewhere: announce the forced navigation.
      if (currentId.value !== was) events.emit('navigate', currentId.value, current.value)
    }
    catch (err) {
      error.value = err
    }
    finally {
      loading.value = false
      initialized.value = true
    }
  }

  /** Applies a move locally and renumbers both containers without waiting for a reload. */
  function applyMove(
    node: ExplorerNode<T>,
    parentId: string | null,
    index: number,
  ) {
    const from = node.parentId ?? null
    const destination = (groups.value.get(parentId) ?? []).filter(
      n => n.id !== node.id,
    )
    destination.splice(
      Math.max(0, Math.min(index, destination.length)),
      0,
      node,
    )

    const positions = new Map<string, number>()
    destination.forEach((n, i) => positions.set(n.id, i))
    if (from !== parentId) {
      (groups.value.get(from) ?? [])
        .filter(n => n.id !== node.id)
        .forEach((n, i) => positions.set(n.id, i))
    }

    nodes.value = nodes.value.map((n) => {
      const position = positions.get(n.id)
      if (n.id === node.id) return { ...n, parentId, position: position ?? 0 }
      return position === undefined ? n : { ...n, position }
    })
    preview.value = null
  }

  function persistMove(
    node: ExplorerNode<T>,
    parentId: string | null,
    index: number,
  ) {
    if (!source.move) return
    applyMove(node, parentId, index)

    const move = { kind: node.kind, id: node.id, parentId, index }
    // Emitted when the grid changes; a failed write emits `error` and reloads.
    events.emit('move', move, node)

    void source
      .move(move)
      .catch(async (err: unknown) => {
        actionError.value = err
        events.emit('error', err)
        // Reload to undo the optimistic move.
        await refresh()
      })
  }

  const drag = createExplorerDrag<T>({
    list: () => children.value,
    preview: list => void (preview.value = list),
    currentId,
    // Stable sort, so this partitions without reordering within groups.
    regroup: list =>
      ordering.value.foldersFirst
        ? [...list].sort(byFoldersFirst)
        : list,
    canMoveInto: canMoveNode,
    persist: persistMove,
    countOf,
  })

  async function run(action: () => Promise<unknown>) {
    try {
      await action()
      await refresh()
    }
    catch (err) {
      actionError.value = err
      events.emit('error', err)
      throw err
    }
  }

  function missing(name: string): never {
    throw new Error(`s99ab: this explorer source implements no ${name}()`)
  }

  function createFolder(input: ExplorerFolderInput) {
    return source.createFolder
      ? run(() => source.createFolder!(input)).then(() => events.emit('create', input))
      : missing('createFolder')
  }

  function renameFolder(id: string, input: ExplorerFolderInput) {
    return source.renameFolder
      ? run(() => source.renameFolder!(id, input)).then(() => events.emit('rename', id, input))
      : missing('renameFolder')
  }

  function deleteFolder(id: string, recursive = false) {
    return source.deleteFolder
      ? run(() => source.deleteFolder!(id, recursive)).then(() => events.emit('remove', id, recursive))
      : missing('deleteFolder')
  }

  function setPinned(id: string, pinned: boolean) {
    return source.pin
      ? run(() => source.pin!(id, pinned)).then(() => events.emit('pin', id, pinned))
      : missing('pin')
  }

  return {
    nodes,
    children,
    currentId,
    current,
    path,
    loading,
    initialized,
    error,
    actionError,
    can,
    icons,
    tile,
    behaviour,
    maxDepth,
    drag,
    events,
    countOf,
    canDrag,
    canCreateIn,
    navigate,
    up,
    refresh,
    createFolder,
    renameFolder,
    deleteFolder,
    setPinned,
  }
}

export type ExplorerApi<T = unknown> = ReturnType<typeof createExplorer<T>>

const instances = new Map<string, unknown>()

export function useExplorer<T = unknown>(
  source: ExplorerSource<T>,
  options: ExplorerOptions<T> = {},
): ExplorerApi<T> {
  if (!options.key) return createExplorer(source, options)

  const cached = instances.get(options.key) as ExplorerApi<T> | undefined
  if (cached) return cached

  const made = createExplorer(source, options)
  instances.set(options.key, made)
  return made
}

/** Drops a cached instance, or all of them. */
export function disposeExplorer(key?: string) {
  if (key === undefined) instances.clear()
  else instances.delete(key)
}

export function provideExplorer<T>(explorer: ExplorerApi<T>) {
  provide(explorerKey, explorer as ExplorerApi)
}

/** The enclosing explorer, injected so a custom tile in the grid slot can take part. */
export function useExplorerContext(): ExplorerApi {
  const explorer = inject(explorerKey, null)
  if (!explorer)
    throw new Error(
      's99ab: no explorer provided; is this inside <UiExplorer>?',
    )
  return explorer
}
