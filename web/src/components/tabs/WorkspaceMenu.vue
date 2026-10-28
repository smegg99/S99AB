<!-- web/src/components/tabs/WorkspaceMenu.vue -->
<template>
  <v-menu
    v-model="menu.open"
    :target="menu.at"
    location="bottom start"
    @click:outside="clickedElsewhere"
  >
    <v-list
      ref="list"
      density="compact"
      class="ctx"
      data-s99ab-menu
    >
      <template
        v-for="entry in menu.entries"
        :key="entry.key"
      >
        <v-divider v-if="entry.divider" />
        <UiDisabledHint
          v-else-if="!entry.children?.length"
          :reason="entry.disabled ? entry.disabledReason ?? '' : ''"
          :label="entry.title"
          location="end"
          block
        >
          <v-list-item
            :title="entry.title"
            :prepend-icon="entry.icon ?? 'mdi-blank'"
            :disabled="entry.disabled"
            :class="{ 'text-error': entry.danger }"
            @click="choose(entry)"
          >
            <!-- Inside the row, which takes the focus; on the host it would open on hover only. -->
            <v-tooltip
              v-if="entry.hint && !entry.disabled"
              :model-value="hintTooltipOpen(entry)"
              activator="parent"
              :text="entry.hint"
              :open-on-focus="true"
              :transition="false"
              :location-strategy="hintBeside"
              @update:model-value="(open: boolean) => setHintTooltipOpen(entry, open)"
            />
            <template
              v-if="entry.keys"
              #append
            >
              <span class="ctx__keys">{{ entry.keys }}</span>
            </template>
          </v-list-item>
        </UiDisabledHint>
        <!-- First row level with the parent row: lifted by SUBMENU_LIFT so the menus' edges meet. -->
        <v-menu
          v-else
          location="end top"
          :offset="[0, SUBMENU_LIFT]"
          open-on-hover
          :open-delay="0"
          :close-delay="0"
          :transition="false"
        >
          <template #activator="{ props }">
            <UiDisabledHint
              :reason="entry.disabled ? entry.disabledReason ?? '' : ''"
              :label="entry.title"
              location="end"
              block
            >
              <v-list-item
                v-bind="props"
                :title="entry.title"
                :prepend-icon="entry.icon ?? 'mdi-blank'"
                append-icon="mdi-chevron-right"
                :disabled="entry.disabled"
              />
            </UiDisabledHint>
          </template>
          <v-list
            density="compact"
            class="ctx"
            data-s99ab-menu
          >
            <UiDisabledHint
              v-for="child in entry.children"
              :key="child.key"
              :reason="child.disabled ? child.disabledReason ?? '' : ''"
              :label="child.title"
              location="end"
              block
            >
              <v-list-item
                :title="child.title"
                :disabled="child.disabled"
                @click="choose(child); menu.open = false"
              >
                <v-tooltip
                  v-if="child.hint && !child.disabled"
                  :model-value="hintTooltipOpen(child)"
                  activator="parent"
                  :text="child.hint"
                  :open-on-focus="true"
                  :transition="false"
                  :location-strategy="hintBesideSubmenu"
                  @update:model-value="(open: boolean) => setHintTooltipOpen(child, open)"
                />
              </v-list-item>
            </UiDisabledHint>
          </v-list>
        </v-menu>
      </template>
    </v-list>
  </v-menu>
</template>

<script setup lang="ts">
import { onBeforeUnmount, ref, watch } from 'vue'
import type { VList } from 'vuetify/components'
import UiDisabledHint from '../primitives/DisabledHint.vue'
import { focused } from '../../composables/primitives/internal/opener'
import { hintTooltipOpen, setHintTooltipOpen } from '../../composables/primitives/internal/tooltip'
import { type MenuEntry, useContextMenuState } from '../../composables/tabs/internal/contextMenu'
import { besideMenu } from '../../composables/tabs/internal/hintPlacement'
import { pressedByKey } from '../../browser/input'

// The workspace's right-click menu; the clicked target supplies the entries.
// Hints and disabled reasons share one window-wide tooltip (primitives/internal/tooltip.ts).
const menu = useContextMenuState()
const list = ref<VList>()
/** A compact list's top inset plus the menu border. */
const SUBMENU_LIFT = 5

// Hints keep off every open menu and the opener row (tabs/internal/hintPlacement.ts).
const hintBeside = besideMenu(() => ({ x: menu.at[0], y: menu.at[1], row: openerRow() }))
// A submenu hint also keeps clear of the parent menu.
const hintBesideSubmenu = besideMenu(() => {
  const parent = list.value?.$el.getBoundingClientRect() as DOMRect | undefined
  const from = parent ? { x: (parent.left + parent.right) / 2, y: (parent.top + parent.bottom) / 2 } : { x: menu.at[0], y: menu.at[1] }
  return { ...from, row: openerRow() }
})

// The menu has no activator, so focus returns to its opener by hand. The ring
// returns too only when a key opened or entered the menu and was pressed last.
let opener: HTMLElement | null = null
let keyboard = false
// Shut by a click elsewhere: the focus stays where that click put it.
let outside = false
function clickedElsewhere() {
  outside = true
}
// The focused opener, when it contains the point the menu opened at.
function openerRow(): HTMLElement | null {
  if (!opener?.isConnected) return null
  const { left, top, right, bottom } = opener.getBoundingClientRect()
  const [x, y] = menu.at
  return x >= left && x <= right && y >= top && y <= bottom ? opener : null
}
const TYPING = 'input, textarea, select, [contenteditable="true"]'

function returnFocus() {
  const el = opener
  if (!el?.isConnected) return
  const ring = keyboard && pressedByKey()
  const active = document.activeElement
  if (active === el) {
    // focus() on the focused element keeps the ring; blur first. Fields keep theirs.
    if (!ring && el.matches(':focus-visible') && !el.matches(TYPING)) {
      el.blur()
      el.focus({ preventScroll: true, focusVisible: false } as FocusOptions)
    }
  }
  else if (!outside && (!active || active === document.body || active.closest('[data-s99ab-menu]'))) {
    el.focus({ preventScroll: true, focusVisible: ring } as FocusOptions)
  }
}

// Focus returns before the entry runs, so a dialog it opens records the opener.
function choose(entry: MenuEntry) {
  returnFocus()
  entry.run?.()
}

// The first arrow, Home or End moves focus into the list; a menu opened at the pointer gets none.
function enter(event: KeyboardEvent) {
  if (event.altKey || event.ctrlKey || event.metaKey || event.shiftKey) return
  const to = ['ArrowDown', 'Home'].includes(event.key) ? 'first' : ['ArrowUp', 'End'].includes(event.key) ? 'last' : undefined
  const target = event.target as HTMLElement | null
  if (!to || target?.closest('.v-overlay__content')) return
  if (['Home', 'End'].includes(event.key) && target?.closest('input, textarea')) return
  event.preventDefault()
  event.stopPropagation()
  keyboard = true
  list.value?.focus(to)
}
// Otherwise a reused entry would show its hint as soon as the menu reopens.
function closeHints() {
  for (const entry of menu.entries) {
    setHintTooltipOpen(entry, false)
    entry.children?.forEach(child => setHintTooltipOpen(child, false))
  }
}
watch(() => menu.open, (open) => {
  if (open) {
    opener = focused()
    keyboard = pressedByKey()
    outside = false
    window.addEventListener('keydown', enter, true)
  }
  else {
    window.removeEventListener('keydown', enter, true)
    closeHints()
    // After the closing keydown (WebKit rings on it) and the unmount flush; skipped if reopened.
    setTimeout(() => menu.open || returnFocus())
  }
}, { immediate: true })
onBeforeUnmount(() => window.removeEventListener('keydown', enter, true))
</script>

<style scoped>
.ctx {
  min-width: 220px;
  max-width: 360px;
  max-height: 70vh;
  overflow-y: auto;
}

.ctx__keys {
  margin-inline-start: 16px;
  color: rgb(var(--v-theme-ink3));
  font-size: var(--s99ab-meta-size);
}
</style>
