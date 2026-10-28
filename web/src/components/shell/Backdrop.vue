<!-- web/src/components/shell/Backdrop.vue -->
<template>
  <div
    :class="{ 's99ab-backdrop--still': still }"
    class="s99ab-backdrop"
    aria-hidden="true"
  />
</template>

<script setup lang="ts">
// The app's ground: four slow-drifting washes of the theme's accent and warning
// hues over the background token. CSS gradients, to stay cheap in a Wails webview.
const { still } = defineProps<{
  /** Stops the drift. The motion level applies without it. */
  still?: boolean
}>()
</script>

<style scoped>
/* Fixed and oversized so the drift never shows an edge. z-index 0, with v-main
   lifted to 1 in AppShell. No will-change, so the layer is released when the
   animation is not running. */
.s99ab-backdrop {
  position: fixed;
  inset: calc(-1 * var(--s99ab-backdrop-bleed));
  z-index: 0;
  pointer-events: none;
  background-image:
    radial-gradient(58% 46% at 16% 18%, color-mix(in srgb, rgb(var(--v-theme-accent)) 55%, transparent) 0%, transparent 68%),
    radial-gradient(46% 38% at 84% 12%, color-mix(in srgb, rgb(var(--v-theme-warning)) 34%, transparent) 0%, transparent 66%),
    radial-gradient(54% 44% at 68% 84%, color-mix(in srgb, rgb(var(--v-theme-accent)) 42%, transparent) 0%, transparent 70%),
    radial-gradient(72% 60% at 4% 96%, color-mix(in srgb, rgb(var(--v-theme-sunk)) 70%, transparent) 0%, transparent 74%);
  opacity: var(--s99ab-backdrop-opacity);
  animation: s99ab-drift var(--s99ab-backdrop-drift) ease-in-out infinite alternate;
}

/* Weaker on dark, where the light-blue accent on near-black is too strong. */
.v-theme--dark .s99ab-backdrop {
  opacity: var(--s99ab-backdrop-opacity-dark);
}

.s99ab-backdrop--still {
  animation: none;
}

/* Transform only, so it composites and never repaints the gradients. */
@keyframes s99ab-drift {
  from {
    transform: translate3d(0, 0, 0) scale(1);
  }

  to {
    transform: translate3d(2.5%, -2%, 0) scale(1.08);
  }
}

/* Stops the drift at `reduced` and `off`, and on an OS reduced-motion request
   under `system` or with no motion attribute (no plugin installed). */
:root[data-motion='reduced'] .s99ab-backdrop,
:root[data-motion='off'] .s99ab-backdrop {
  animation: none;
}

@media (prefers-reduced-motion: reduce) {
  :root:not([data-motion]) .s99ab-backdrop,
  :root[data-motion='system'] .s99ab-backdrop {
    animation: none;
  }
}
</style>
