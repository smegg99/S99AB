<!-- web/src/components/primitives/ToolKey.vue -->
<template>
  <button
    :class="{ 'key--active': active }"
    :disabled="disabled"
    :title="title"
    :aria-label="ariaLabel"
    :aria-pressed="active"
    class="key"
    type="button"
    @click="emit('click', $event)"
  >
    <v-icon
      v-if="icon"
      :icon="icon"
      class="key__icon"
      size="16"
    />
    <template v-if="label">
      {{ label }}
    </template>
  </button>
</template>

<script setup lang="ts">
import { computed } from 'vue'

// One key of a segmented control. A native button, since keys share borders and
// v-btn variants cannot. aria-pressed; UiToolGroup adds role="group".
const { label, icon, title, active, disabled } = defineProps<{
  label?: string
  icon?: string
  /** Tooltip, and the accessible name of an icon-only key. */
  title?: string
  active?: boolean
  disabled?: boolean
}>()

// Carries the event for an animation that starts at the cursor.
const emit = defineEmits<{ click: [event: MouseEvent] }>()

// Only an icon-only key needs a name; a labelled one would be read twice.
const ariaLabel = computed(() => (label ? undefined : title))
</script>

<style scoped>
/* The face is built here, since keys share borders and v-btn variants cannot. */
.key {
  display: inline-flex;
  flex: 0 0 auto;
  align-items: center;
  justify-content: center;
  gap: var(--s99ab-control-gap);
  /* The shared control height, so it follows dense rows. */
  min-height: var(--s99ab-control-h);
  padding: 0 var(--s99ab-pad-tight);
  border: 1px solid rgb(var(--v-theme-edge));
  border-radius: var(--s99ab-radius);
  background: rgb(var(--v-theme-raised));
  color: rgb(var(--v-theme-ink2));
  cursor: pointer;
  font-family: inherit;
  font-size: var(--s99ab-label-size);
  font-weight: 600;
  line-height: 1;
  transition:
    background var(--s99ab-motion-fast) var(--s99ab-motion-easing),
    color var(--s99ab-motion-fast) var(--s99ab-motion-easing);
}

.key:hover:not(:disabled) {
  background: rgb(var(--v-theme-chrome2));
  color: rgb(var(--v-theme-ink));
}

/* Pressed is a filled face. */
.key--active {
  background: rgb(var(--v-theme-accent));
  border-color: rgb(var(--v-theme-accent));
  color: rgb(var(--v-theme-on-accent));
}

.key--active:hover:not(:disabled) {
  background: rgb(var(--v-theme-accent));
  color: rgb(var(--v-theme-on-accent));
}

.key:disabled {
  cursor: default;
  opacity: 0.45;
}

/* The ring is from _focus.scss; this stacks it above the neighbour. */
.key:focus-visible {
  position: relative;
  z-index: 2;
}

.key__icon {
  opacity: 0.9;
}
</style>
