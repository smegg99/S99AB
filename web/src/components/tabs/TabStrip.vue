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
        v-for="(tab, i) in displayed"
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
        :aria-label="tab.pinned ? titleOf(tab) : undefined"
        :aria-selected="tab.id === ws.activeId"
        :aria-controls="`panel-${tab.id}`"
        :tabindex="tab.id === ws.activeId ? 0 : -1"
        @click="onClick(tab)"
        @mousedown="onMousedown"
        @pointerdown="onPointerdown($event, tab)"
        @auxclick="onAuxclick($event, tab)"
        @contextmenu="openContextMenu($event, tabMenu(tab))"
        @keydown="onKeydown($event, i)"
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
import { computed, nextTick, onMounted, onScopeDispose, ref, watch, type ComponentPublicInstance } from 'vue'
import type { MenuEntry } from '../../composables/tabs/internal/contextMenu'
import { openContextMenu, useContextMenuState } from '../../composables/tabs/internal/contextMenu'
import { useTabDrag, type TabWorkspace, type NativeTabDrag } from '../../composables/tabs/internal/tabDrag'
import type { WorkspaceTab } from '../../composables/tabs/useTabs'
import UiDisabledHint from '../primitives/DisabledHint.vue'
import { hintTooltipOpen, setHintTooltipOpen } from '../../composables/primitives/internal/tooltip'
import { titleWords } from '../../composables/tabs/internal/titleWords'
import { drawChip } from '../../composables/tabs/internal/drawChip'

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
const INCOMING = 'incoming-native-tab'

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
const incomingFace = computed(() => props.native?.incoming?.face)
let slotFrame = 0
function nameOf(tab: T) {
  return tab.id === INCOMING ? incomingFace.value?.title ?? '' : props.titleOf(tab)
}
watch(() => !!props.native?.incoming, (on) => {
  dropping.value = on
  cancelAnimationFrame(slotFrame)
  if (on) slotFrame = requestAnimationFrame(measureSlot)
  else dropSlot.value = null
}, { immediate: true })

// Measured every frame while dropping: the slot slides and the strip scrolls.
function measureSlot() {
  const el = elements.get(INCOMING)
  const strip = list.value?.parentElement
  let next: { left: number, width: number } | null = null
  if (el && strip && list.value) {
    const origin = strip.getBoundingClientRect().left
    const view = list.value.getBoundingClientRect()
    const box = el.getBoundingClientRect()
    const left = Math.max(box.left, view.left)
    const right = Math.min(box.right, view.right)
    if (right > left) next = { left: Math.round(left - origin), width: Math.round(right - left) }
  }
  const was = dropSlot.value
  if (next?.left !== was?.left || next?.width !== was?.width) dropSlot.value = next
  slotFrame = requestAnimationFrame(measureSlot)
}

// The native drag image, drawn once per drag from the pill.
const ghostEl = ref<HTMLElement | null>(null)
let pictured = ''
watch(ghostEl, (el) => {
  const id = props.native?.dragging
  if (!el || !id || pictured === id) return
  pictured = id
  const scale = Math.max(1, Math.ceil(window.devicePixelRatio || 1))
  const png = drawChip(el, scale)
  if (png) props.native?.image(png, scale, GRAB, GRAB)
}, { flush: 'post' })
const displayed = computed(() => {
  const tabs = [...shown.value]
  if (props.native?.incoming) tabs.splice(props.native?.incoming.slot, 0, { id: INCOMING } as T)
  return tabs
})
// Describe layout coordinates, excluding the incoming gap and transforms.
let observer: ResizeObserver | undefined
let frame = 0
function queueStrip() {
  cancelAnimationFrame(frame)
  frame = requestAnimationFrame(() => {
    const el = list.value
    if (!el || !props.native) return
    const bounds = el.getBoundingClientRect()
    const gap = elements.get(INCOMING)
    const gapWidth = gap ? gap.offsetWidth + 2 : 0
    const tabs = shown.value.flatMap((tab) => {
      const item = elements.get(tab.id)
      if (!item) return []
      const shift = gap && item.offsetLeft > gap.offsetLeft ? gapWidth : 0
      return [{ id: tab.id, x: Math.round(bounds.left + item.offsetLeft - el.scrollLeft - shift), width: item.offsetWidth, pinned: !!tab.pinned }]
    })
    props.native.strip({ bounds: { x: Math.round(bounds.left), y: Math.round(bounds.top), width: Math.round(bounds.width), height: Math.round(bounds.height) }, tabs })
  })
}
onMounted(() => {
  observer = new ResizeObserver(queueStrip)
  if (list.value) {
    observer.observe(list.value)
    list.value.addEventListener('scroll', queueStrip)
  }
  queueStrip()
})
watch(displayed, () => {
  void nextTick(queueStrip)
}, { deep: true })
onScopeDispose(() => {
  observer?.disconnect()
  cancelAnimationFrame(frame)
  cancelAnimationFrame(slotFrame)
  list.value?.removeEventListener('scroll', queueStrip)
})

watch(() => ws.activeId, async (id) => {
  await nextTick()
  elements.get(id)?.scrollIntoView({ block: 'nearest', inline: 'nearest' })
})

function onWheel(event: WheelEvent) {
  if (!list.value || Math.abs(event.deltaX) > Math.abs(event.deltaY)) return
  list.value.scrollLeft += event.deltaY
}

// ---- mouse and keys ---------------------------------------------------------

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

function onKeydown(event: KeyboardEvent, i: number) {
  // Modified arrows belong to app shortcuts.
  if (event.altKey || event.ctrlKey || event.metaKey) return
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

// ---- context menu -----------------------------------------------------------

const menu = useContextMenuState()

// Past the last tab.
function onStripMenu(event: MouseEvent) {
  if (event.defaultPrevented) return
  openContextMenu(event, props.stripMenu())
}
</script>

<style scoped>
/* Floor as a shadow, so the active tab can paint over it. */
.strip {
  display: flex;
  height: var(--s99ab-tab-height, 34px);
  min-width: 0;
  align-items: stretch;
  background: rgb(var(--v-theme-chrome));
  box-shadow: inset 0 -1px 0 rgb(var(--v-theme-line));
}

/* Positioned, so a tab's offsetLeft is measured from here. */
.strip__tabs {
  position: relative;
  display: flex;
  min-width: 0;
  flex: 1 1 auto;
  gap: 2px;
  overflow-x: auto;
  scrollbar-width: none;
}

.strip__tabs::-webkit-scrollbar {
  display: none;
}

.tab {
  --tab-close: 20px;

  position: relative;
  display: flex;
  width: 184px;
  min-width: 104px;
  flex: 0 1 auto;
  align-items: center;
  gap: 6px;
  /* The cross is equidistant from the right, top and bottom edges. */
  padding: 0 calc((var(--s99ab-tab-height, 34px) - var(--tab-close)) / 2) 0 10px;
  border-radius: var(--s99ab-tab-radius, 5px) var(--s99ab-tab-radius, 5px) 0 0;
  box-shadow: inset 0 -1px 0 rgb(var(--v-theme-line));
  color: rgb(var(--v-theme-ink3));
  font-size: var(--s99ab-nav-item-size);
  cursor: pointer;
}

.tab:hover {
  background: rgb(var(--v-theme-chrome2));
  color: rgb(var(--v-theme-ink2));
}

/* Side lines sit in the gap outside the tab, so the strip clips them where the
   pane's own frame takes over. */
.tab--active,
.tab--active:hover {
  background: rgb(var(--v-theme-background));
  box-shadow: 1px 0 0 rgb(var(--v-theme-line)), -1px 0 0 rgb(var(--v-theme-line));
  color: rgb(var(--v-theme-ink));
}

.tab:focus-visible {
  outline: 2px solid var(--s99ab-focus-ring);
  outline-offset: -2px;
}

.tab--pinned {
  width: 40px;
  min-width: 40px;
  justify-content: center;
  padding: 0;
}

.tab__icon {
  flex: none;
}

.tab--active .tab__icon {
  color: rgb(var(--s99ab-tile-accent, var(--v-theme-accent)));
}

.tab__title {
  min-width: 0;
  flex: 1 1 auto;
}

.tab__word {
  display: inline-block;
}

/* Always laid out, so the title never shifts. */
.tab__close {
  display: grid;
  width: var(--tab-close);
  height: var(--tab-close);
  flex: none;
  place-items: center;
  border-radius: var(--s99ab-radius);
  color: rgb(var(--v-theme-ink3));
  opacity: 0;
}

.tab:hover .tab__close,
.tab--active .tab__close {
  opacity: 1;
}

.tab__close:hover {
  background: rgb(var(--v-theme-lineSoft));
  color: rgb(var(--v-theme-ink));
}

.tab__close:disabled {
  background: none;
  color: rgba(var(--v-theme-ink3), var(--v-disabled-opacity));
  cursor: default;
}

/* The slot a tab from another window would land in: drawn as the dropped
   tab, with the drop look (_drop.scss) open at the bottom. */
.tab--incoming {
  background: rgb(var(--v-theme-background));
  box-shadow: none;
  color: rgb(var(--v-theme-ink));
  pointer-events: none;
}

.tab--incoming .tab__icon {
  color: rgb(var(--s99ab-tile-accent, var(--v-theme-accent)));
}

/* A tab moved along its own strip leaves a plain cut where it lands, its
   contents dimmed: the pill carries it. */
.tab--dragged,
.tab--dragged:hover {
  background: rgb(var(--v-theme-background));
  box-shadow: 1px 0 0 rgb(var(--v-theme-line)), -1px 0 0 rgb(var(--v-theme-line));
  color: rgb(var(--v-theme-ink));
}

.tab--dragged > * {
  opacity: 0.35;
}

/* Same pace as .s99ab-flip-move. */
.strip__tabs--gliding .tab--moving {
  transition: transform var(--s99ab-motion-base) var(--s99ab-motion-easing);
}

:root[data-motion='reduced'] .strip__tabs--gliding .tab--moving,
:root[data-motion='off'] .strip__tabs--gliding .tab--moving {
  transition: none;
}

@media (prefers-reduced-motion: reduce) {
  :root[data-motion='system'] .strip__tabs--gliding .tab--moving {
    transition: none;
  }
}

/* Matches .s99ab-explorer-ghost; positioned under the pointer by hand. */
.ghost {
  position: fixed;
  top: 0;
  left: 0;
  z-index: 3000;
  display: inline-flex;
  max-width: calc(var(--s99ab-tile-min) * 2);
  align-items: center;
  gap: var(--s99ab-control-gap);
  padding: var(--s99ab-control-gap) var(--s99ab-pad-tight);
  border: 1px solid rgb(var(--s99ab-tile-accent, var(--v-theme-accent)));
  border-radius: var(--s99ab-tile-radius);
  background-color: rgb(var(--v-theme-raised));
  color: rgb(var(--v-theme-on-surface));
  font-size: var(--s99ab-tile-title);
  line-height: 18px;
  white-space: nowrap;
  pointer-events: none;
}

.ghost__icon {
  flex: none;
  color: rgb(var(--s99ab-tile-accent, var(--v-theme-accent)));
  font-size: 18px;
}

.ghost__name {
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
}
</style>
