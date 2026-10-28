// web/src/composables/explorer/useExplorerNode.ts

// Tile behaviour: drag and drop, click semantics and drag-state classes.
// Any element becomes a tile by spreading `bind`.

import { computed, type MaybeRefOrGetter, onScopeDispose, toValue } from 'vue'
import { useExplorerContext } from './useExplorer'
import { useExplorerFace } from './useExplorerFace'
import { TILE_ATTR } from './internal/keys'
import { useExplorerSelectionContext } from './useExplorerSelection'
import type { ExplorerNode } from './internal/tree'
import { useTranslate } from '../useTranslate'

import { noActions, useExplorerActions, dragHasFiles } from './internal/actions'

/** Tile actions the screen owns: opening a leaf and the context menu. */
export interface ExplorerActions<T = unknown> {
  open: (node: ExplorerNode<T>) => void
  menu: (node: ExplorerNode<T>, event: MouseEvent) => void
  /** Whether the node has menu entries; hides the ... trigger otherwise. */
  canMenu?: (node: ExplorerNode<T>) => boolean
  /** External file drop and its target folder; absent leaves the drop to the browser. */
  files?: (parentId: string | null, files: File[]) => void
}

/** Fraction of a folder tile's width at each side that reorders a dragged folder instead of nesting it. */
const EDGE = 0.38

/** Replaces the drag image with a small pill holding a clone of the tile's icon element. */
function setDragImage(event: DragEvent, node: ExplorerNode, carrying: number, many: string) {
  const transfer = event.dataTransfer
  if (!transfer || typeof document === 'undefined') return

  const preview = document.createElement('div')
  preview.className = 's99ab-explorer-ghost'
  if (node.accent) preview.dataset.accent = node.accent

  const icon = (event.currentTarget as HTMLElement | null)?.querySelector(
    '.s99ab-tile__icon',
  )
  if (icon) preview.append(icon.cloneNode(true))

  const label = document.createElement('span')
  // A group shows its count instead of one name.
  label.textContent = carrying > 1 ? many : node.name
  preview.append(label)

  document.body.append(preview)
  transfer.setDragImage(preview, 16, 16)
  // The snapshot is synchronous; the node only has to outlive this frame.
  requestAnimationFrame(() => preview.remove())
}

export function useExplorerNode<T = unknown>(
  node: MaybeRefOrGetter<ExplorerNode<T>>,
) {
  const explorer = useExplorerContext()
  const actions = useExplorerActions()
  const selection = useExplorerSelectionContext()
  const t = useTranslate()

  const target = computed(() => toValue(node) as ExplorerNode)
  const isFolder = computed(() => target.value.kind === 'folder')
  const disabled = computed(() => !!target.value.disabled)
  const dropKey = computed(() => `node:${target.value.id}`)
  const isSource = computed(() => explorer.drag.isDragging(target.value.id))
  const isDropTarget = computed(
    () => explorer.drag.hover.value === dropKey.value && !isSource.value,
  )
  const count = computed(() =>
    isFolder.value ? explorer.countOf(target.value.id) : 0,
  )
  // A disabled node has no menu.
  const hasMenu = computed(
    () => actions !== noActions
      && !disabled.value
      && (actions.canMenu?.(target.value) ?? true),
  )
  const pinned = computed(() => !!target.value.pinned)
  const selected = computed(() => !!selection?.isSelected(target.value.id))
  const selectable = computed(() => !!selection?.active.value)

  const face = useExplorerFace(() => target.value, {
    isFolder: () => isFolder.value,
    isTarget: () => isDropTarget.value,
    count: () => count.value,
  })

  /** Target folder for a file dropped on this tile; a leaf uses the open folder. */
  const dropParent = computed(() =>
    isFolder.value ? target.value.id : explorer.currentId.value,
  )

  const classes = computed(() => ({
    's99ab-tile--folder': isFolder.value,
    's99ab-tile--item': !isFolder.value,
    's99ab-tile--media': !!face.image.value,
    's99ab-tile--over': face.over.value,
    's99ab-tile--source': isSource.value,
    's99ab-tile--target': isDropTarget.value,
    's99ab-tile--selected': selected.value,
    's99ab-tile--disabled': disabled.value,
    's99ab-tile--pinned': pinned.value,
  }))

  // Spring-loading: a folder under a drag opens after behaviour.springOpen ms.
  let spring: ReturnType<typeof setTimeout> | undefined

  function armSpring() {
    const wait = explorer.behaviour.value.springOpen
    if (spring || !wait || !isFolder.value) return
    spring = setTimeout(() => {
      spring = undefined
      // Only if the drag is still over this tile.
      if (isDropTarget.value) explorer.navigate(target.value.id)
    }, wait)
  }

  function disarmSpring() {
    if (spring) clearTimeout(spring)
    spring = undefined
  }

  onScopeDispose(disarmSpring)

  function onDragstart(event: DragEvent) {
    // Dragging an unselected tile makes it the selection first.
    selection?.ensure(target.value)
    const carried = selected.value ? (selection?.ordered() ?? []) : []

    explorer.drag.begin(target.value, carried)
    if (!event.dataTransfer) return
    event.dataTransfer.effectAllowed = 'move'
    // Some browsers do not start a drag with an empty transfer.
    event.dataTransfer.setData('text/plain', target.value.id)
    setDragImage(
      event,
      target.value,
      explorer.drag.group.value.length,
      t('explorer.dragging', '{count} items', { count: explorer.drag.group.value.length }),
    )
  }

  function onDragover(event: DragEvent) {
    event.preventDefault()

    // External files: no reorder or nesting applies.
    if (dragHasFiles(event)) {
      if (!actions.files) return
      if (event.dataTransfer) event.dataTransfer.dropEffect = 'copy'
      explorer.drag.setHover(dropKey.value)
      return
    }

    if (isSource.value) return

    const intoAllowed
      = isFolder.value && explorer.drag.canDrop(target.value.id)
    if (event.dataTransfer) event.dataTransfer.dropEffect = 'move'

    // Cannot nest here: reorder beside this tile, on the pointer's side.
    if (!intoAllowed) {
      disarmSpring()
      explorer.drag.setHover(null)
      explorer.drag.previewReorder(target.value.id, pastHalf(event))
      return
    }

    // An item files inside; a folder nests on the centre and reorders on the edges.
    if (explorer.drag.node.value?.kind !== 'folder') {
      explorer.drag.setHover(dropKey.value)
      armSpring()
      return
    }

    const edge = edgeOf(event)
    if (edge === 'centre') {
      explorer.drag.setHover(dropKey.value)
      armSpring()
      return
    }
    disarmSpring()
    explorer.drag.setHover(null)
    explorer.drag.previewReorder(target.value.id, edge === 'end')
  }

  function onDragleave() {
    disarmSpring()
    explorer.drag.clearHover(dropKey.value)
  }

  function onDrop(event: DragEvent) {
    event.preventDefault()
    // The grid's own drop handler would append instead.
    event.stopPropagation()
    disarmSpring()

    if (dragHasFiles(event)) {
      explorer.drag.setHover(null)
      const files = [...(event.dataTransfer?.files ?? [])]
      if (files.length) actions.files?.(dropParent.value, files)
      return
    }

    const into = isDropTarget.value
    explorer.drag.setHover(null)
    if (into) explorer.drag.dropInto(target.value.id)
    else explorer.drag.commitReorder()
  }

  function onDragend() {
    disarmSpring()
    explorer.drag.finish()
  }

  function open() {
    if (disabled.value) return
    if (isFolder.value) explorer.navigate(target.value.id)
    else actions.open(target.value)
  }

  function menu(event: MouseEvent) {
    if (disabled.value) return
    actions.menu(target.value, event)
  }

  // `double`: a click selects. `single`: a plain click opens and selects nothing.
  function onClick(event: MouseEvent) {
    if (disabled.value) return

    const mods = { ctrl: event.ctrlKey || event.metaKey, shift: event.shiftKey }
    const modified = mods.ctrl || mods.shift
    const twoClicks = explorer.behaviour.value.activate === 'double'

    if (twoClicks || modified) selection?.pick(target.value, mods)
    if (modified || twoClicks) return
    open()
  }

  function onDblclick() {
    if (explorer.behaviour.value.activate === 'double') open()
  }

  function onKeydown(event: KeyboardEvent) {
    if (event.key === 'Enter') {
      event.preventDefault()
      open()
      return
    }
    // With selection on, the grid handles space; otherwise space opens like Enter.
    if (event.key === ' ' && !selectable.value) {
      event.preventDefault()
      open()
    }
  }

  // The menu acts on the selection; an unselected tile becomes the selection first.
  function onContextmenu(event: MouseEvent) {
    event.preventDefault()
    selection?.ensure(target.value)
    menu(event)
  }

  /** Spread onto the tile root: role, focus, the tile marker and handlers, nothing visual. */
  const bind = computed(() => ({
    'role': 'button',
    'tabindex': 0,
    // Carries the id, which the grid's keys and rubber band read from the DOM.
    [TILE_ATTR]: target.value.id,
    'draggable': explorer.canDrag(target.value),
    'aria-disabled': disabled.value || undefined,
    'aria-selected': selectable.value ? selected.value : undefined,
    'onClick': onClick,
    'onDblclick': onDblclick,
    'onKeydown': onKeydown,
    'onContextmenu': onContextmenu,
    'onDragstart': onDragstart,
    'onDragover': onDragover,
    'onDragleave': onDragleave,
    'onDrop': onDrop,
    'onDragend': onDragend,
  }))

  return {
    node: target,
    isFolder,
    isSource,
    isDropTarget,
    disabled,
    pinned,
    selected,
    selectable,
    count,
    hasMenu,
    classes,
    bind,
    open,
    menu,
    ...face,
  }
}

function pastHalf(event: DragEvent): boolean {
  const rect = (event.currentTarget as HTMLElement).getBoundingClientRect()
  return event.clientX - rect.left > rect.width / 2
}

function edgeOf(event: DragEvent): 'start' | 'centre' | 'end' {
  const rect = (event.currentTarget as HTMLElement).getBoundingClientRect()
  const x = event.clientX - rect.left
  if (x < rect.width * EDGE) return 'start'
  if (x > rect.width * (1 - EDGE)) return 'end'
  return 'centre'
}
