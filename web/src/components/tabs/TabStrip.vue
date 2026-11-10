<!-- web/src/components/tabs/TabStrip.vue -->
<template>
  <div
    class="strip"
    @contextmenu="onStripMenu"
  >
    <!-- Tabs slide only during a drag; css:false keeps open and close instant. -->
    <TransitionGroup
      ref="group"
      :css="false"
      move-class="tab--moving"
      tag="div"
      class="strip__tabs"
      :class="{ 'strip__tabs--gliding': glide || props.native?.incoming }"
      role="tablist"
      :aria-label="tabsLabel"
      @wheel="onWheel"
    >
      <div
        v-for="tab in displayed"
        :id="`tab-${tab.id}`"
        :key="tab.id"
        :ref="el => mark(tab.id, el)"
        class="tab"
        :class="{
          'tab--active': tab.id === ws.activeId,
          'tab--pinned': tab.pinned,
          'tab--dragged': dragging === tab.id,
          'tab--incoming': tab.id === INCOMING,
          's99ab-drop s99ab-drop--open': tab.id === INCOMING,
        }"
        role="tab"
        :aria-hidden="tab.id === INCOMING || undefined"
        :data-accent="tab.id === INCOMING ? incomingFace?.tint : tintOf(tab)"
        :aria-label="tab.id === INCOMING ? undefined : titleOf(tab)"
        :aria-selected="tab.id === ws.activeId"
        :aria-controls="`panel-${tab.id}`"
        :tabindex="tab.id === ws.activeId ? 0 : -1"
        @click="onClick(tab)"
        @mousedown="onMousedown"
        @pointerdown="onPointerdown($event, tab)"
        @auxclick="onAuxclick($event, tab)"
        @contextmenu="openContextMenu($event, tabMenu(tab))"
        @keydown="onKeydown($event, tab)"
      >
        <v-icon
          :icon="tab.id === INCOMING ? incomingFace?.icon ?? 'mdi-tab-plus' : iconOf(tab)"
          class="tab__icon"
          size="16"
        />
        <!-- Words after the first are inline boxes, so the ellipsis cuts at a word boundary. -->
        <span
          v-if="!tab.pinned && (tab.id !== INCOMING || incomingFace)"
          class="tab__title text-truncate"
        ><template
          v-for="(word, at) in titleWords(nameOf(tab))"
          :key="at"
        >{{ at ? ' ' : '' }}<span :class="{ tab__word: at > 0 }">{{ word }}</span></template></span>
        <!-- A tab moving to another window cannot close; the cross shows why. -->
        <UiDisabledHint
          v-if="!tab.pinned && tab.id !== INCOMING"
          :reason="tab.moving ? movingReason : ''"
          :label="closeLabel(tab)"
        >
          <button
            class="tab__close"
            type="button"
            tabindex="-1"
            :aria-label="closeLabel(tab)"
            :disabled="!!tab.moving"
            @click.stop="ws.close(tab.id)"
          >
            <v-icon
              icon="mdi-close"
              size="14"
            />
          </button>
        </UiDisabledHint>
        <!-- Off while the tab moves; shares the window-wide hint tooltip slot. -->
        <v-tooltip
          v-if="tab.id !== INCOMING"
          :model-value="hintTooltipOpen(tab)"
          :text="titleOf(tab)"
          :disabled="menu.open || dragging !== null || !!tab.moving"
          activator="parent"
          location="bottom"
          @update:model-value="(open: boolean) => setHintTooltipOpen(tab, open)"
        />
      </div>
    </TransitionGroup>

    <!-- The drag pill, as an Explorer tile drags. -->
    <Teleport to="body">
      <div
        v-if="ghost"
        ref="ghostEl"
        class="ghost"
        :data-accent="tintOf(ghost.tab)"
        :style="{ transform: `translate(${ghost.x - GRAB}px, ${ghost.y - GRAB}px)` }"
        aria-hidden="true"
      >
        <v-icon
          :icon="iconOf(ghost.tab)"
          class="ghost__icon"
        />
        <span class="ghost__name">{{ titleOf(ghost.tab) }}</span>
      </div>
    </Teleport>
  </div>
</template>

<script setup lang="ts" generic="T extends WorkspaceTab">
import { computed, nextTick, ref, watch, type ComponentPublicInstance } from 'vue'
import UiDisabledHint from '../primitives/DisabledHint.vue'
import type { MenuEntry } from '../../composables/tabs/internal/contextMenu'
import { openContextMenu, useContextMenuState } from '../../composables/tabs/internal/contextMenu'
import { useTabDrag, type TabWorkspace, type NativeTabDrag } from '../../composables/tabs/internal/tabDrag'
import type { WorkspaceTab } from '../../composables/tabs/useTabs'
import { hintTooltipOpen, setHintTooltipOpen } from '../../composables/primitives/internal/tooltip'
import { titleWords } from '../../composables/tabs/internal/titleWords'
import { INCOMING, useNativeStrip } from '../../composables/tabs/internal/nativeStrip'

const props = defineProps<{
  workspace: TabWorkspace<T>
  titleOf: (tab: T) => string
  iconOf: (tab: T) => string
  tintOf: (tab: T) => string | undefined
  tabsLabel: string
  closeLabel: (tab: T) => string
  /** Localized reason a moving tab cannot be closed. */
  movingReason: string
  tabMenu: (tab: T) => MenuEntry[]
  stripMenu: () => MenuEntry[]
  native?: NativeTabDrag<T>
}>()
/** Whether a tab from another window would land in this one if dropped now. */
const dropping = defineModel<boolean>('dropping', { default: false })
/** While dropping, the slot's span from the strip's left edge, for .s99ab-drop--slot. */
const dropSlot = defineModel<{ left: number, width: number } | null>('dropSlot', { default: null })
const ws = props.workspace

const group = ref<ComponentPublicInstance | null>(null)
const list = computed(() => group.value?.$el as HTMLElement | undefined)
const elements = new Map<string, HTMLElement>()

function mark(id: string, el: Element | ComponentPublicInstance | null) {
  if (el instanceof HTMLElement) elements.set(id, el)
  else elements.delete(id)
}

/** Pointer offset into the pill, matching the layer's drag image. */
const GRAB = 16
const { shown, dragging, glide, ghost, onPointerdown, wasDropped } = useTabDrag(list, elements, ws, () => props.native, tab => ({
  title: props.titleOf(tab),
  icon: props.iconOf(tab),
  tint: props.tintOf(tab),
}))
const ghostEl = ref<HTMLElement | null>(null)
const { incomingFace, nameOf, displayed } = useNativeStrip({
  native: () => props.native,
  list,
  elements,
  shown,
  titleOf: props.titleOf,
  dropping,
  dropSlot,
  ghost: ghostEl,
  grab: GRAB,
})

watch(() => ws.activeId, async (id) => {
  await nextTick()
  elements.get(id)?.scrollIntoView({ block: 'nearest', inline: 'nearest' })
})

function onWheel(event: WheelEvent) {
  if (!list.value || Math.abs(event.deltaX) > Math.abs(event.deltaY)) return
  list.value.scrollLeft += event.deltaY
}

function onClick(tab: T) {
  // Ignore the click that ends a drop.
  if (wasDropped() || tab.id === INCOMING) return
  ws.activate(tab.id)
}

function onMousedown(event: MouseEvent) {
  // Middle button closes; stop the webview's autoscroll.
  if (event.button === 1) event.preventDefault()
}

function onAuxclick(event: MouseEvent, tab: T) {
  if (event.button === 1 && !tab.moving) ws.close(tab.id)
}

// The tab's index in the workspace, not in `displayed`, which can hold the incoming gap and a drag's order.
function onKeydown(event: KeyboardEvent, from: T) {
  // Modified arrows belong to app shortcuts.
  if (event.altKey || event.ctrlKey || event.metaKey) return
  const i = ws.tabs.findIndex(tab => tab.id === from.id)
  if (i === -1) return
  const count = ws.tabs.length
  const to = {
    ArrowRight: (i + 1) % count,
    ArrowLeft: (i - 1 + count) % count,
    Home: 0,
    End: count - 1,
  }[event.key]
  if (to !== undefined) {
    event.preventDefault()
    const tab = ws.tabs[to]
    if (!tab) return
    ws.activate(tab.id)
    void nextTick(() => elements.get(tab.id)?.focus())
    return
  }
  if (event.key === 'Delete') {
    event.preventDefault()
    const tab = ws.tabs[i]
    if (tab && !tab.moving) ws.close(tab.id)
  }
}

const menu = useContextMenuState()

// Past the last tab.
function onStripMenu(event: MouseEvent) {
  if (event.defaultPrevented) return
  openContextMenu(event, props.stripMenu())
}
</script>

<style scoped src="./strip.css" />
