<!-- web/src/components/explorer/ExplorerGrid.vue -->
<template>
  <!-- The open folder's children. Only reorders animate (FLIP); no enter or
       leave, so opening a folder swaps the contents at once. css:false stops Vue
       treating a tile's hover transition as a leave and waiting for
       transitionend. A drop between tiles commits the previewed move. -->
  <TransitionGroup
    :css="false"
    :class="{ 's99ab-explorer__grid--dragging': explorer.drag.active.value }"
    tag="div"
    name="s99ab-flip"
    class="s99ab-explorer__grid"
    role="listbox"
    :aria-label="contentsLabel"
    :aria-multiselectable="selection?.mode.value === 'multi' || undefined"
    @focusin="onFocusin"
    @dragover.prevent="onDragover"
    @drop.prevent="onDrop"
    @keydown="onKeydown"
  >
    <UiExplorerUpTile
      v-if="explorer.currentId.value !== null"
      key="__up"
    />
    <slot
      v-for="node in explorer.children.value"
      :key="node.id"
      :node="node"
      name="tile"
    >
      <UiExplorerTile :node="node" />
    </slot>
  </TransitionGroup>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import UiExplorerTile from './ExplorerTile.vue'
import UiExplorerUpTile from './ExplorerUpTile.vue'
import { useExplorerContext } from '../../composables/explorer/useExplorer'
import { useExplorerKeys } from '../../composables/explorer/internal/keys'
import { dragHasFiles, useExplorerActions } from '../../composables/explorer/internal/actions'
import { useExplorerSelectionContext } from '../../composables/explorer/useExplorerSelection'
import type { ExplorerNode } from '../../composables/explorer/internal/tree'
import { useTranslate } from '../../composables/useTranslate'
import { TILE_ATTR } from '../../browser/tiles'

defineSlots<{
  tile?: (props: { key: string, node: ExplorerNode }) => unknown
}>()

// Injected, so the grid can sit anywhere under <UiExplorer>.
const explorer = useExplorerContext()
const actions = useExplorerActions()
const selection = useExplorerSelectionContext()
const t = useTranslate()
const contentsLabel = computed(() => t('explorer.contents', 'Folder contents'))

/** The focused tile keeps the grid's Tab stop, so Tab returns to it. */
function onFocusin(event: FocusEvent) {
  const id = (event.target as Element | null)?.closest?.(`[${TILE_ATTR}]`)?.getAttribute(TILE_ATTR)
  if (id !== null && id !== undefined) explorer.lastFocused.value = id
}

const { onKeydown } = useExplorerKeys({
  enabled: () => explorer.behaviour.value.keyboard,
  // Arrow keys move the selection; ctrl moves focus only (handled in the composable).
  moved: (id, mods) => {
    const node = explorer.children.value.find(n => n.id === id)
    if (node) selection?.pick(node, { shift: mods.shift })
  },
  choose: (id, mods) => {
    const node = explorer.children.value.find(n => n.id === id)
    if (!node) return
    if (mods.ctrl) selection?.toggle(node)
    else selection?.pick(node, {})
  },
  selectAll: () => {
    if (selection?.mode.value !== 'multi') return false
    selection.all()
    return true
  },
  clear: () => {
    if (!selection?.active.value || !selection.ids.value.length) return false
    selection.clear()
    return true
  },
})

function onDragover(event: DragEvent) {
  // Files dropped on the background go to the open folder; otherwise the browser navigates to them.
  if (dragHasFiles(event) && actions.files && event.dataTransfer) {
    event.dataTransfer.dropEffect = 'copy'
  }
}

function onDrop(event: DragEvent) {
  if (dragHasFiles(event)) {
    const files = [...(event.dataTransfer?.files ?? [])]
    if (files.length) actions.files?.(explorer.currentId.value, files)
    return
  }
  explorer.drag.commitReorder()
}
</script>
