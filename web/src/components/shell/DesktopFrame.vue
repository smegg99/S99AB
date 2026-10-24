<!-- web/src/components/shell/DesktopFrame.vue -->
<template>
  <div
    class="s99ab-frame"
    :class="{ 's99ab-frame--fill': fill }"
  >
    <main class="s99ab-frame__view">
      <slot />
    </main>

    <footer class="s99ab-frame__status">
      <slot name="status" />
    </footer>
  </div>
</template>

<script setup lang="ts">
// The window frame: the view and the status row; only the view scrolls.
defineProps<{
  /** The view is one full-size screen that owns its own scrolling: the workspace. */
  fill?: boolean
}>()
</script>

<style scoped>
/* Pinned to the viewport rather than sized from its ancestors: v-app's own
   wrap is a flex column whose height depends on rules this app does not own. */
.s99ab-frame {
  /* Corner inset shared by the status row and the sign-in corner keys. */
  --s99ab-frame-inset: 0.5rem;

  position: fixed;
  display: grid;
  inset: 0;
  grid-template-rows: minmax(0, 1fr) auto;
  gap: 0.5rem;
  padding: var(--s99ab-frame-inset) var(--s99ab-frame-inset) 0.25rem;
  overflow: hidden;
  background: rgb(var(--v-theme-background));
}

/* A one-row grid, since a percentage height against a scroll container does not resolve reliably in WebKit. */
.s99ab-frame__view {
  display: grid;
  min-height: 0;
  grid-template-rows: minmax(min-content, 1fr);
  overflow-y: auto;
  scrollbar-gutter: stable;
}

/* min() so a wider child does not get negative auto margins and slide off the left edge. */
.s99ab-frame__view > :deep(*) {
  width: min(var(--s99ab-container), 100%);
  margin-inline: auto;
  padding: var(--s99ab-page-y) var(--s99ab-pad);
}

.s99ab-frame--fill .s99ab-frame__view {
  /* Exactly the room above the status row, never the height of
     whatever the workspace holds: the panes inside scroll on their own. */
  grid-template-rows: minmax(0, 1fr);
  overflow: hidden;
  scrollbar-gutter: auto;
}

.s99ab-frame--fill .s99ab-frame__view > :deep(*) {
  width: auto;
  min-width: 0;
  margin: 0;
  padding: 0;
}

.s99ab-frame__status {
  display: grid;
  height: 28px;
  min-width: 0;
  margin-top: -4px;
}
</style>

<style>
/* The desktop frame owns viewport scrolling and selection; text controls opt back in. */
html:has(.s99ab-frame),
body:has(.s99ab-frame) { height: 100%; overflow: hidden; }
:root:has(.s99ab-frame) :is(.v-application, .v-overlay-container) { user-select: none; -webkit-user-select: none; }
:root:has(.s99ab-frame) :is(input, textarea, [contenteditable='true']) { user-select: text; -webkit-user-select: text; }
</style>
