<!-- web/src/components/explorer/ExplorerToolbar.vue -->
<template>
  <!-- The shared strip: same height, inset and control row as a panel head. -->
  <div class="s99ab-explorer__bar">
    <!-- The path scrolls sideways, so the actions stay on one line. -->
    <div
      ref="crumbsEl"
      :class="{
        's99ab-explorer__crumbs--fade-start': fadeStart,
        's99ab-explorer__crumbs--fade-end': fadeEnd,
      }"
      class="s99ab-explorer__crumbs"
      @scroll="updateFade"
    >
      <template
        v-for="(crumb, i) in crumbs"
        :key="crumb.key"
      >
        <!-- Decorative separator, hidden from screen readers. -->
        <span
          v-if="i"
          class="s99ab-explorer__sep"
          aria-hidden="true"
        >/</span>
        <div
          :class="{
            's99ab-explorer__crumb--current': crumb.current,
            's99ab-explorer__crumb--target': isTarget(crumb),
          }"
          :data-accent="crumb.accent || undefined"
          class="s99ab-explorer__crumb"
          @dragover.prevent="onDragover(crumb)"
          @dragleave="onDragleave(crumb)"
          @drop.prevent="onDrop(crumb)"
        >
          <v-btn
            :prepend-icon="crumb.icon"
            :aria-current="crumb.ariaCurrent"
            variant="text"
            size="small"
            @click="explorer.navigate(crumb.id)"
          >
            {{ crumb.name }}
          </v-btn>
        </div>
      </template>
    </div>

    <div class="s99ab-explorer__actions s99ab-controls">
      <!-- Selection count and actions, shown beside the ordinary actions. -->
      <template v-if="picked.length">
        <span class="s99ab-explorer__picked">{{ pickedLabel }}</span>
        <slot
          name="selection"
          :nodes="picked"
        />
        <v-btn
          :aria-label="clearLabel"
          icon="mdi-close"
          variant="text"
          size="small"
          @click="selection?.clear()"
        />
      </template>

      <slot name="actions" />

      <v-btn
        v-if="explorer.can.value.rename && explorer.current.value"
        :aria-label="renameLabel"
        icon
        variant="text"
        size="small"
        @click="folders.rename(explorer.current.value)"
      >
        <v-icon :icon="explorer.icons.value.rename" />
        <!-- Shares the window-wide hint slot (primitives/internal/tooltip.ts). -->
        <v-tooltip
          :model-value="hintTooltipOpen(renameHint)"
          :text="renameLabel"
          activator="parent"
          @update:model-value="(open: boolean) => setHintTooltipOpen(renameHint, open)"
        />
      </v-btn>

      <UiDisabledHint
        v-if="explorer.can.value.create"
        :reason="canCreate ? '' : createTooltip"
        :label="createLabel"
      >
        <v-btn
          :aria-label="createLabel"
          :disabled="!canCreate"
          icon
          variant="text"
          size="small"
          @click="folders.create()"
        >
          <v-icon :icon="explorer.icons.value.create" />
          <v-tooltip
            :model-value="hintTooltipOpen(createHint)"
            :disabled="!canCreate"
            :text="createTooltip"
            activator="parent"
            @update:model-value="(open: boolean) => setHintTooltipOpen(createHint, open)"
          />
        </v-btn>
      </UiDisabledHint>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { useExplorerContext } from '../../composables/explorer/useExplorer'
import { useExplorerCrumbs } from '../../composables/explorer/useExplorerCrumbs'
import { useExplorerFolders } from '../../composables/explorer/useExplorerFolders'
import { useExplorerSelectionContext } from '../../composables/explorer/useExplorerSelection'
import { useTranslate } from '../../composables/useTranslate'
import { hintTooltipOpen, setHintTooltipOpen } from '../../composables/primitives/internal/tooltip'
import UiDisabledHint from '../primitives/DisabledHint.vue'

const explorer = useExplorerContext()
const folders = useExplorerFolders(explorer)
const selection = useExplorerSelectionContext()
const t = useTranslate()
const {
  crumbs,
  crumbsEl,
  fadeStart,
  fadeEnd,
  isTarget,
  updateFade,
  onDragover,
  onDragleave,
  onDrop,
} = useExplorerCrumbs(explorer)

const picked = computed(() => selection?.nodes.value ?? [])
/** Owner keys for the two tooltips in the window-wide hint slot. */
const renameHint = {}
const createHint = {}

const createLabel = computed(() => t('explorer.newFolder', 'New folder'))
const renameLabel = computed(() => t('explorer.renameFolder', 'Rename folder'))
const depthLabel = computed(() => t('explorer.maxDepth', 'Folders cannot nest any deeper.'))
const clearLabel = computed(() => t('explorer.clearSelection', 'Clear selection'))
const pickedLabel = computed(() => t(
  'explorer.selected',
  '{count} selected',
  { count: picked.value.length },
))

const canCreate = computed(() => explorer.canCreateIn(explorer.currentId.value))
// The depth cap is the only reason the button is disabled.
const createTooltip = computed(() => (canCreate.value ? createLabel.value : depthLabel.value))
</script>
