<!-- web/src/components/explorer/Explorer.vue -->
<template>
  <!-- A fixed toolbar above an independently scrolling grid. -->
  <div
    :style="tileStyle"
    :data-tile-hover="explorer.tile.value.hover"
    :data-tile-variant="explorer.tile.value.variant"
    :data-tile-menu="explorer.tile.value.menu"
    class="s99ab-explorer"
  >
    <UiExplorerToolbar>
      <template #actions>
        <slot name="actions" />
      </template>
      <template
        v-if="slots.selection"
        #selection="{ nodes }"
      >
        <slot
          name="selection"
          :nodes="typedList(nodes)"
        />
      </template>
    </UiExplorerToolbar>

    <!-- Deselect and rubber band start from the same press on the whole region,
         including the empty space below the grid. -->
    <div
      class="s99ab-explorer__scroll"
      @mousedown="onMousedown"
    >
      <!-- The skeleton uses the grid's columns, gap and tile, and is named for
           the status region. -->
      <div
        v-if="firstLoad"
        :aria-label="loadingLabel"
        class="s99ab-explorer__grid"
        role="status"
        aria-busy="true"
      >
        <div
          v-for="n in placeholders"
          :key="n"
          class="s99ab-tile s99ab-tile--skeleton"
        />
      </div>

      <UiErrorState
        v-else-if="explorer.error.value"
        :error="explorer.error.value"
        @retry="explorer.refresh()"
      />

      <template v-else>
        <!-- Keyed, so the whole grid swaps; a tile's hover transition would
             otherwise hold leaving tiles for a frame. -->
        <UiExplorerGrid
          v-if="hasGrid"
          :key="gridKey"
        >
          <template
            v-if="slots.tile"
            #tile="{ node }"
          >
            <slot
              name="tile"
              :node="typed(node)"
            />
          </template>
        </UiExplorerGrid>

        <slot
          v-if="isEmpty"
          name="empty"
        >
          <UiEmptyState
            :icon="explorer.icons.value.folder"
            :title="emptyHeading"
            :text="emptyText"
          />
        </slot>
      </template>

      <div
        v-if="band"
        :style="bandStyle"
        class="s99ab-explorer__band"
      />
    </div>

    <v-menu
      v-model="menuOpen"
      :target="menuAt"
    >
      <v-list v-if="menuNode">
        <slot
          name="menu"
          :node="menuNode"
        />
        <v-list-item
          v-if="explorer.can.value.pin"
          :title="menuNode.pinned ? unpinLabel : pinLabel"
          :prepend-icon="explorer.icons.value.pin"
          @click="explorer.setPinned(menuNode.id, !menuNode.pinned)"
        />
        <template v-if="menuNode.kind === 'folder'">
          <v-list-item
            v-if="explorer.can.value.rename"
            :title="renameLabel"
            @click="folders.rename(menuNode)"
          />
          <v-list-item
            v-if="explorer.can.value.remove"
            :title="deleteLabel"
            class="text-error"
            @click="folders.remove(menuNode)"
          />
          <v-list-item
            v-if="explorer.can.value.remove"
            :title="deleteAllLabel"
            class="text-error"
            @click="folders.remove(menuNode, true)"
          />
        </template>
      </v-list>
    </v-menu>
  </div>
</template>

<script setup lang="ts" generic="T = unknown">
import { computed, onMounted, watch } from 'vue'
import UiEmptyState from '../state/EmptyState.vue'
import UiErrorState from '../state/ErrorState.vue'
import UiExplorerGrid from './ExplorerGrid.vue'
import UiExplorerToolbar from './ExplorerToolbar.vue'
import { useApiError } from '../../composables/state/useApiError'
import { type ExplorerApi, provideExplorer } from '../../composables/explorer/useExplorer'
import { useExplorerConfig } from '../../composables/explorer/useExplorerConfig'
import { bindExplorerEvents } from '../../composables/explorer/useExplorerEvents'
import { useExplorerFolders } from '../../composables/explorer/useExplorerFolders'
import { useExplorerGridState } from '../../composables/explorer/useExplorerGridState'
import { useExplorerMarquee } from '../../composables/explorer/useExplorerMarquee'
import { useExplorerMenu } from '../../composables/explorer/useExplorerMenu'
import {
  provideExplorerSelection,
  useExplorerSelection,
} from '../../composables/explorer/useExplorerSelection'
import type { ExplorerFolderInput, ExplorerMove } from '../../composables/explorer/internal/types'
import type { ExplorerNode } from '../../composables/explorer/useExplorerTree'
import { useToast } from '../../composables/toast/useToast'
import { useTranslate } from '../../composables/useTranslate'

// The whole explorer in one tag. A screen supplies the source, what opening a
// leaf does, and its own menu entries.
const {
  explorer,
  tileMin,
  emptyTitle,
  emptyText,
  autoLoad = true,
  acceptFiles = false,
} = defineProps<{
  /**
   * Read once at setup and provided below. To show a different tree, key the
   * <UiExplorer> instead of swapping this prop.
   */
  explorer: ExplorerApi<T>
  /** Grid column floor in px. Overrides the app config for this instance. */
  tileMin?: number
  emptyTitle?: string
  emptyText?: string
  /** Loads on mount unless the screen already has. */
  autoLoad?: boolean
  /** Catches files dragged in from outside the page. Off by default. */
  acceptFiles?: boolean
}>()

const emit = defineEmits<{
  open: [node: ExplorerNode<T>]
  navigate: [id: string | null, node: ExplorerNode<T> | null]
  move: [move: ExplorerMove, node: ExplorerNode<T>]
  create: [input: ExplorerFolderInput]
  rename: [id: string, input: ExplorerFolderInput]
  delete: [id: string, recursive: boolean]
  pin: [id: string, pinned: boolean]
  select: [nodes: ExplorerNode<T>[]]
  menu: [node: ExplorerNode<T>, event: MouseEvent]
  files: [parentId: string | null, files: File[]]
  error: [err: unknown]
}>()

/** Picked tile ids. Written only when selection is on. */
const selected = defineModel<string[]>('selected', { default: () => [] })

// Declared so slots receive ExplorerNode<T> instead of ExplorerNode<unknown>.
const slots = defineSlots<{
  actions?: () => unknown
  selection?: (props: { nodes: ExplorerNode<T>[] }) => unknown
  tile?: (props: { node: ExplorerNode<T> }) => unknown
  empty?: () => unknown
  menu?: (props: { node: ExplorerNode<T> }) => unknown
}>()

const t = useTranslate()
const toast = useToast()
const describe = useApiError()
const config = useExplorerConfig()
const folders = useExplorerFolders(explorer)
const selection = useExplorerSelection(explorer, selected)
const { firstLoad, placeholders, isEmpty, hasGrid, gridKey } = useExplorerGridState(explorer)
const {
  menuOpen,
  menuAt,
  menuNode,
  renameLabel,
  deleteLabel,
  deleteAllLabel,
  pinLabel,
  unpinLabel,
} = useExplorerMenu<T>({
  open: node => emit('open', node),
  menu: (node, event) => emit('menu', node, event),
  canEdit: () => explorer.can.value.rename || explorer.can.value.remove,
  canPin: () => explorer.can.value.pin,
  pinWords: () => config.pin,
  hasSlot: () => !!slots.menu,
  files: acceptFiles ? (parentId, files) => emit('files', parentId, files) : undefined,
})

provideExplorer(explorer)
provideExplorerSelection(selection)

// Re-emits the instance's events as component events, in the same order.
bindExplorerEvents<T>(explorer.events, {
  navigate: (id, node) => emit('navigate', id, node),
  move: (move, node) => emit('move', move, node),
  create: input => emit('create', input),
  rename: (id, input) => emit('rename', id, input),
  remove: (id, recursive) => emit('delete', id, recursive),
  pin: (id, pinned) => emit('pin', id, pinned),
  error: err => emit('error', err),
})

// What was picked before the band started: kept on ctrl-drag, empty otherwise.
let base: string[] = []

const { band, onMousedown: startBand } = useExplorerMarquee({
  enabled: () => selection.mode.value === 'multi',
  cover: (ids) => {
    const covered = new Set([...base, ...ids])
    selection.set(explorer.children.value
      .filter(n => covered.has(n.id) && !n.disabled)
      .map(n => n.id))
  },
  clear: () => selection.clear(),
})

const bandStyle = computed(() => ({
  left: `${band.value?.left ?? 0}px`,
  top: `${band.value?.top ?? 0}px`,
  width: `${band.value?.width ?? 0}px`,
  height: `${band.value?.height ?? 0}px`,
}))

/** A press between or below the tiles. Deselects on mousedown, so the deselect
 *  and a following rubber band are one gesture. */
function onMousedown(event: MouseEvent) {
  const onTile = (event.target as HTMLElement | null)?.closest('.s99ab-tile')
  if (!onTile && !(event.ctrlKey || event.metaKey)) selection.clear()
  base = onTile ? [] : [...selection.ids.value]
  startBand(event)
}

const tileStyle = computed(() => ({
  '--s99ab-tile-min': `${tileMin ?? config.tileMin}px`,
  '--s99ab-tile-aspect': String(explorer.tile.value.aspect),
  '--s99ab-tile-fit': explorer.tile.value.fit,
}))
const emptyHeading = computed(() => emptyTitle ?? t('explorer.empty', 'This folder is empty'))
const loadingLabel = computed(() => t('explorer.loading', 'Loading folder'))

watch(selected, () => emit('select', selection.nodes.value as ExplorerNode<T>[]))

// A failed move or folder action is shown as a toast; the tree has already reloaded.
watch(() => explorer.actionError.value, (err) => {
  if (err) toast.error(describe(err).text)
})

onMounted(() => {
  if (autoLoad && !explorer.initialized.value) void explorer.refresh()
})

// The grid and toolbar pass nodes back untyped; same objects, retyped.
function typed(node: ExplorerNode): ExplorerNode<T> {
  return node as ExplorerNode<T>
}

function typedList(nodes: ExplorerNode[]): ExplorerNode<T>[] {
  return nodes as ExplorerNode<T>[]
}
</script>
