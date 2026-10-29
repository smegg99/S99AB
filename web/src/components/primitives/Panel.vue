<!-- web/src/components/primitives/Panel.vue -->
<template>
  <section
    :aria-label="title"
    class="panel s99ab-slab"
  >
    <header
      v-if="hasHead"
      class="panel__head"
    >
      <slot name="head">
        <span
          v-if="icon"
          class="panel__icon"
        >
          <v-icon :icon="icon" />
        </span>

        <span
          v-if="title"
          class="panel__title"
        >{{ title }}</span>

        <span class="panel__sp" />

        <span
          v-if="slots.meta"
          class="panel__meta"
        >
          <slot name="meta" />
        </span>

        <span
          v-if="slots.actions"
          class="panel__actions s99ab-controls"
        >
          <slot name="actions" />
        </span>
      </slot>
    </header>

    <div
      class="panel__body"
      :class="{ 'panel__body--flush': flush }"
    >
      <p
        v-if="subtitle"
        class="panel__lead"
      >
        {{ subtitle }}
      </p>

      <slot />
    </div>

    <footer
      v-if="slots.footer"
      class="panel__foot"
    >
      <slot name="footer" />
    </footer>
  </section>
</template>

<script setup lang="ts">
import { computed, useSlots } from 'vue'

// The layer's content surface: a chrome head strip over a well. The title also
// names the <section>, so it is exposed as a landmark.
const { title, flush } = defineProps<{
  title?: string
  /** A sentence at the top of the body, held to a measure. */
  subtitle?: string
  icon?: string
  /** Drops the body padding, for a table or a grid that pads itself. */
  flush?: boolean
}>()
defineSlots<{ head?: () => unknown, meta?: () => unknown, actions?: () => unknown, default?: () => unknown, footer?: () => unknown }>()

const slots = useSlots()

// No head strip for an untitled panel with nothing in its head.
const hasHead = computed(() =>
  Boolean(slots.head || title || slots.meta || slots.actions),
)
</script>

<style scoped>
/* Frame, radius and well come from .s99ab-slab; the panel stacks head, body and foot. */
.panel {
  display: flex;
  flex-direction: column;
  min-width: 0;
}

/* The strip height for any head content. min-height and wrapping, so extra
   content wraps to a second line instead of clipping. */
.panel__head {
  display: flex;
  flex: 0 0 auto;
  flex-wrap: wrap;
  align-items: center;
  gap: var(--s99ab-control-gap);
  min-height: var(--s99ab-strip-h);
  padding: var(--s99ab-strip-pad-y) var(--s99ab-strip-pad-x);
  background: rgb(var(--v-theme-chrome2));
  border-bottom: 1px solid rgb(var(--v-theme-line));
}

/* The same tracked capitals as .s99ab-eyebrow, in ink2 since it titles the
   surface. :slotted lends these to a custom #head. */
.panel__title,
:slotted(.panel__title) {
  flex: 0 1 auto;
  min-width: 0;
  overflow: hidden;
  color: rgb(var(--v-theme-ink2));
  font-size: var(--s99ab-label-size);
  font-weight: 700;
  letter-spacing: var(--s99ab-label-track);
  text-overflow: ellipsis;
  text-transform: var(--s99ab-label-case);
  white-space: nowrap;
}

/* An element, since v-spacer's flex-grow arrives with a later Vuetify chunk.
   Separate from the optional title so meta and actions still go right. */
.panel__sp,
:slotted(.panel__sp) {
  flex: 1 1 auto;
}

/* The glyph size the actions are levelled to in _controls.scss. */
.panel__icon {
  display: inline-flex;
  flex: 0 0 auto;
  color: rgb(var(--v-theme-ink3));
}

.panel__icon .v-icon {
  font-size: var(--s99ab-icon);
}

.panel__meta,
:slotted(.panel__meta) {
  flex: 0 0 auto;
  color: rgb(var(--v-theme-ink3));
  font-size: var(--s99ab-meta-size);
  font-variant-numeric: tabular-nums;
  white-space: nowrap;
}

/* Heights and gap come from .s99ab-controls. */
.panel__actions {
  flex: 0 0 auto;
}

/* min-height 0, so a scrolling child gets a bounded height. */
.panel__body {
  display: flex;
  flex: 1 1 auto;
  flex-direction: column;
  min-height: 0;
  min-width: 0;
  padding: var(--s99ab-pad);
}

.panel__body--flush {
  padding: 0;
}

/* Below body size and held to a measure, so it does not read as content. */
.panel__lead {
  max-width: var(--s99ab-measure);
  margin: 0 0 var(--s99ab-pad-tight);
  color: rgb(var(--v-theme-ink3));
  font-size: var(--s99ab-lead-size);
  line-height: 1.5;
}

/* A flush body has no inset, so the lead brings the same one on all sides,
   including below, to separate it from a table header. */
.panel__body--flush .panel__lead {
  padding: var(--s99ab-pad-tight) var(--s99ab-pad);
  margin-bottom: 0;
}

/* The same strip height as the head. */
.panel__foot {
  display: flex;
  flex: 0 0 auto;
  align-items: center;
  gap: var(--s99ab-control-gap);
  min-height: var(--s99ab-strip-h);
  padding: var(--s99ab-strip-pad-y) var(--s99ab-strip-pad-x);
  background: rgb(var(--v-theme-chrome2));
  border-top: 1px solid rgb(var(--v-theme-line));
}
</style>
