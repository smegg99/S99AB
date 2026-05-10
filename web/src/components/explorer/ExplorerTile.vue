<!-- web/src/components/explorer/ExplorerTile.vue -->
<template>
  <div
    v-bind="bind"
    :class="classes"
    :data-accent="node.accent || undefined"
    class="s99ab-tile"
  >
    <!-- Corner badge: a folder's child count, or the app's slot or node badge.
         Yields the corner when the app also asked for a pick tick. -->
    <slot
      v-if="!ticking"
      :node="node"
      name="badge"
    >
      <span
        v-if="badge"
        class="s99ab-tile__count"
      >{{ badge }}</span>
    </slot>

    <v-icon
      v-else
      :icon="selected ? icons.selected : icons.unselected"
      class="s99ab-tile__check"
    />

    <!-- Pinned mark. Yields its corner to the ... trigger under the pointer. -->
    <v-icon
      v-if="pinned"
      :icon="icons.pin"
      class="s99ab-tile__pin"
    />

    <!-- Opens a menu without starting the tile's drag. draggable=false removes
         it from the drag surface; the stopped dragstart covers other browsers. -->
    <v-btn
      v-if="trigger"
      :aria-label="moreLabel"
      :icon="icons.menu"
      class="s99ab-tile__more"
      variant="text"
      size="x-small"
      draggable="false"
      @click.stop="menu"
      @mousedown.stop
      @dragstart.stop.prevent
    />

    <div
      v-if="layout === 'head'"
      class="s99ab-tile__head"
    >
      <v-icon
        :icon="icon"
        class="s99ab-tile__icon"
      />
      <span class="s99ab-tile__title">{{ node.name }}</span>
    </div>

    <template v-else>
      <div class="s99ab-tile__thumb">
        <slot
          :node="node"
          name="thumb"
        >
          <!-- A plain img (see useExplorerFace); on error it falls back to the
               glyph. draggable=false so a press drags the tile instead of the picture.
               Empty alt because the name is shown below. -->
          <img
            v-if="image"
            :src="image"
            alt=""
            class="s99ab-tile__image"
            loading="lazy"
            decoding="async"
            draggable="false"
            @error="onImageError"
          >
          <v-icon
            v-else
            :icon="icon"
            class="s99ab-tile__icon"
          />
        </slot>
      </div>

      <div class="s99ab-tile__label">
        <span class="s99ab-tile__title">{{ node.name }}</span>
      </div>
    </template>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { useExplorerContext } from '../../composables/explorer/useExplorer'
import type { ExplorerNode } from '../../composables/explorer/useExplorerTree'
import { useExplorerNode } from '../../composables/explorer/useExplorerNode'
import { useTranslate } from '../../composables/useTranslate'

// One tile for both kinds: a folder is an icon and a name, anything with a
// picture is that picture with the name on a strip.
const { node } = defineProps<{ node: ExplorerNode }>()

const t = useTranslate()
const explorer = useExplorerContext()
const {
  selectable,
  selected,
  pinned,
  hasMenu,
  classes,
  bind,
  icon,
  image,
  layout,
  badge,
  menu,
  onImageError,
} = useExplorerNode(() => node)

const icons = computed(() => explorer.icons.value)
const ticking = computed(() => selectable.value && explorer.tile.value.check)
// The app can hide the ... trigger; right-click still opens the menu.
const trigger = computed(() => hasMenu.value && explorer.tile.value.menu !== 'none')
const moreLabel = computed(() => t('explorer.more', 'More'))
</script>
