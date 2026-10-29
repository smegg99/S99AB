<!-- web/src/components/explorer/ExplorerUpTile.vue -->
<template>
  <!-- The ".." tile of a non-root folder: click to go up, drop to move up a level. -->
  <div
    v-bind="marker"
    :class="{ 's99ab-tile--target': isTarget }"
    class="s99ab-tile s99ab-tile--up"
    role="option"
    :tabindex="explorer.tabStop.value === '' ? 0 : -1"
    aria-selected="false"
    draggable="false"
    @click="explorer.up()"
    @keydown.enter="explorer.up()"
    @keydown.space.prevent="explorer.up()"
    @dragover.prevent="onDragover"
    @dragleave="explorer.drag.clearHover(KEY)"
    @drop.stop.prevent="onDrop"
  >
    <div class="s99ab-tile__head">
      <v-icon
        :icon="explorer.icons.value.up"
        class="s99ab-tile__icon"
      />
      <span class="s99ab-tile__title">{{ label }}</span>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { useExplorerContext } from '../../composables/explorer/useExplorer'
import { dragHasFiles, useExplorerActions } from '../../composables/explorer/internal/actions'
import { useTranslate } from '../../composables/useTranslate'
import { TILE_ATTR } from '../../browser/tiles'

const KEY = 'up'

const explorer = useExplorerContext()
const actions = useExplorerActions()
const t = useTranslate()

// Carries the tile marker so arrow keys reach it. Not a node, so not draggable.
const marker = { [TILE_ATTR]: '' }

const parentId = computed(() => explorer.current.value?.parentId ?? null)
const isTarget = computed(() => explorer.drag.hover.value === KEY)
const label = computed(() => t('explorer.up', 'Up'))

function onDragover(event: DragEvent) {
  if (dragHasFiles(event)) {
    if (!actions.files) return
    if (event.dataTransfer) event.dataTransfer.dropEffect = 'copy'
    explorer.drag.setHover(KEY)
    return
  }
  if (explorer.drag.canDrop(parentId.value)) explorer.drag.setHover(KEY)
}

function onDrop(event: DragEvent) {
  explorer.drag.setHover(null)

  if (dragHasFiles(event)) {
    const files = [...(event.dataTransfer?.files ?? [])]
    if (files.length) actions.files?.(parentId.value, files)
    return
  }
  explorer.drag.dropInto(parentId.value)
}
</script>
