// web/src/composables/explorer/useExplorerDrag.ts

// Explorer drag state on native HTML5 drag and drop: the browser handles autoscroll,
// escape and the drop cursor, and Vue keeps owning the DOM.

import { computed, type Ref, shallowRef } from 'vue'
import type { ExplorerNode } from './useExplorerTree'

/** What the drag needs from the explorer. */
export interface ExplorerDragHost<T = unknown> {
  /** The open folder's children as rendered, preview included. */
  list: () => ExplorerNode<T>[]
  /** Shows an unsaved order; null restores the tree's. */
  preview: (nodes: ExplorerNode<T>[] | null) => void
  currentId: Ref<string | null>
  /** Re-applies grouping (e.g. folders first) after a preview. */
  regroup: (nodes: ExplorerNode<T>[]) => ExplorerNode<T>[]
  canMoveInto: (node: ExplorerNode<T>, parentId: string | null) => boolean
  persist: (node: ExplorerNode<T>, parentId: string | null, index: number) => void
  countOf: (parentId: string | null) => number
}

function sameOrder<T>(a: readonly ExplorerNode<T>[], b: readonly ExplorerNode<T>[]): boolean {
  return a.length === b.length && a.every((node, i) => node.id === b[i]!.id)
}

export function createExplorerDrag<T = unknown>(host: ExplorerDragHost<T>) {
  const node = shallowRef<ExplorerNode<T> | null>(null)
  /** Everything carried, dragged tile first; the whole selection when one was dragged. */
  const group = shallowRef<ExplorerNode<T>[]>([])
  /** Key of the target under the pointer: a tile, the up target or a crumb. */
  const hover = shallowRef<string | null>(null)
  const active = computed(() => node.value !== null)

  // Ending where it started writes nothing.
  let startIndex = -1
  // Set by a drop so the following dragend does not commit again.
  let handled = false

  function begin(dragged: ExplorerNode<T>, others: readonly ExplorerNode<T>[] = []) {
    handled = false
    node.value = dragged
    group.value = [dragged, ...others.filter(n => n.id !== dragged.id)]
    startIndex = host.list().findIndex(n => n.id === dragged.id)
  }

  function end() {
    node.value = null
    group.value = []
    hover.value = null
    host.preview(null)
  }

  /** Whether this tile is in the carried group. */
  function isDragging(id: string): boolean {
    return group.value.some(n => n.id === id)
  }

  function canDrop(parentId: string | null): boolean {
    return node.value !== null && host.canMoveInto(node.value, parentId)
  }

  function setHover(key: string | null) {
    hover.value = key
  }

  /** Clears only when this target is still the hovered one. */
  function clearHover(key: string) {
    if (hover.value === key) hover.value = null
  }

  /** Previews the dragged tile in a new slot without committing. */
  function previewReorder(targetId: string, after = false) {
    const dragged = node.value
    if (!dragged || dragged.id === targetId) return

    const current = host.list()
    const next = [...current]
    const from = next.findIndex(n => n.id === dragged.id)
    if (from === -1) return
    next.splice(from, 1)

    let at = next.findIndex(n => n.id === targetId)
    if (at === -1) return
    if (after) at += 1
    next.splice(at, 0, dragged)

    const ordered = host.regroup(next)
    if (sameOrder(ordered, current)) return
    host.preview(ordered)
  }

  /** Writes the previewed order; also the fallback when a drag just ends. */
  function commitReorder() {
    handled = true
    const dragged = node.value
    const carried = group.value
    // Read before end() drops the preview.
    const list = host.list()
    end()
    if (!dragged) return

    const index = list.findIndex(n => n.id === dragged.id)
    // A spring-open changed folder mid-drag: file the nodes into the open folder.
    if (index === -1) {
      fileInto(carried, host.currentId.value)
      return
    }
    // Dropped back where it started with nothing else carried: no write.
    const still = index === startIndex
      && (dragged.parentId ?? null) === host.currentId.value
    if (still && carried.length === 1) return
    if (!host.canMoveInto(dragged, host.currentId.value)) return

    host.persist(dragged, host.currentId.value, index)
    // The rest of the group lands right after it, in grid order.
    let at = index + 1
    for (const extra of carried.slice(1)) {
      if (host.canMoveInto(extra, host.currentId.value)) {
        host.persist(extra, host.currentId.value, at)
        at += 1
      }
    }
  }

  /** Files the carried nodes into a folder, the parent or a crumb's folder. */
  function dropInto(parentId: string | null) {
    handled = true
    const carried = group.value
    end()
    fileInto(carried, parentId)
  }

  // One move per node; countOf is re-read each time so the nodes land in order.
  function fileInto(carried: readonly ExplorerNode<T>[], parentId: string | null) {
    for (const dragged of carried) {
      // Already in that folder: do not shuffle it to the end.
      if ((dragged.parentId ?? null) === parentId) continue
      if (!host.canMoveInto(dragged, parentId)) continue

      host.persist(dragged, parentId, host.countOf(parentId))
    }
  }

  /** dragend: commits the preview unless a drop already handled it. */
  function finish() {
    if (!handled) {
      commitReorder()
      return
    }
    handled = false
    end()
  }

  return {
    node,
    group,
    hover,
    active,
    begin,
    end,
    isDragging,
    canDrop,
    setHover,
    clearHover,
    previewReorder,
    commitReorder,
    dropInto,
    finish,
  }
}

export type ExplorerDrag<T = unknown> = ReturnType<typeof createExplorerDrag<T>>
