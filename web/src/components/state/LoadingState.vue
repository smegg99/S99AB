<!-- web/src/components/state/LoadingState.vue -->
<template>
  <div
    v-if="isSkeleton"
    :class="rowsClass"
    :aria-label="label"
    class="s99ab-skeleton"
    role="status"
    aria-busy="true"
  >
    <div
      v-for="row in rows"
      :key="row"
      class="s99ab-skeleton__row"
    >
      <span class="s99ab-skeleton__bar s99ab-skeleton__bar--title" />
      <span
        v-if="hasSubBar"
        class="s99ab-skeleton__bar s99ab-skeleton__bar--sub"
      />
    </div>
  </div>

  <div
    v-else
    :class="shellClass"
    :aria-label="label"
    class="s99ab-state s99ab-state--loading"
    role="status"
    aria-busy="true"
  >
    <UiGoo :dense="inline" />

    <div
      v-if="text"
      class="s99ab-state__body"
    >
      <p class="s99ab-state__text">
        {{ text }}
      </p>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import UiGoo from './Goo.vue'
import { useTranslate } from '../../composables/useTranslate'

// A skeleton for lists, matching row height, padding and count; otherwise the
// state shell in the accent with the goo loader.
const { variant = 'spinner', rows = 3, lines = 'two', inline = false, text } = defineProps<{
  variant?: 'spinner' | 'skeleton'
  /** A small loader in a row, for non-list content; a full-size one would make the page jump. */
  inline?: boolean
  /** Rows the content will have; match the page size. */
  rows?: number
  /** One bar per row, or a title and a subtitle; match the list. */
  lines?: 'one' | 'two'
  text?: string
}>()

const t = useTranslate()

const isSkeleton = computed(() => variant === 'skeleton')
const hasSubBar = computed(() => lines === 'two')
const rowsClass = computed(() => `s99ab-skeleton--${lines}`)
const shellClass = computed(() => inline ? 's99ab-state--loading-inline' : 's99ab-state--center')

// A default label, since both roots are live regions with no readable content.
const label = computed(() => text ?? t('common.loading', 'Loading'))
</script>

<style scoped>
/* The skeleton's own metrics, sized from the layer's list rows. The inline
   variant is a row, roughly a stat row or a short paragraph. */
.s99ab-state--loading-inline {
  align-items: center;
  min-height: 48px;
  padding-block: var(--s99ab-control-gap);
}

/* v-list-item metrics at density compact: 40px one line, 56 two, 16px padding. */
.s99ab-skeleton__row {
  display: flex;
  flex-direction: column;
  justify-content: center;
  gap: 4px;
  padding-inline: var(--s99ab-pad);
}

.s99ab-skeleton--one .s99ab-skeleton__row {
  min-height: 40px;
}

.s99ab-skeleton--two .s99ab-skeleton__row {
  min-height: 56px;
  padding-block: 4px;
}

/* Ink at low alpha, so it reads on either variant. A gradient sweeps across
   by background-position, with no repaint of the row. */
.s99ab-skeleton__bar {
  display: block;
  height: 0.72rem;
  border-radius: 2px;
  background:
    linear-gradient(
      90deg,
      rgba(var(--v-theme-neutral), var(--s99ab-skeleton-rest)) 0%,
      rgba(var(--v-theme-neutral), var(--s99ab-skeleton-peak)) 45%,
      rgba(var(--v-theme-neutral), var(--s99ab-skeleton-rest)) 90%
    );
  background-size: 220% 100%;
  animation: s99ab-skeleton 1.6s ease-in-out infinite;
}

/* Typical widths of the two lines. */
.s99ab-skeleton__bar--title {
  width: 38%;
}

.s99ab-skeleton__bar--sub {
  width: 62%;
  height: 0.62rem;
  opacity: 0.7;
}

/* All rows sweep together; nothing knows the request's progress. */
@keyframes s99ab-skeleton {
  from { background-position: 120% 0; }
  to { background-position: -120% 0; }
}

/* Reduced motion swaps the sweep for a fade. */
@media (prefers-reduced-motion: reduce) {
  .s99ab-skeleton__bar {
    background: rgba(var(--v-theme-neutral), var(--s99ab-skeleton-rest));
    animation: s99ab-skeleton-fade 1.8s ease-in-out infinite;
  }
}

@keyframes s99ab-skeleton-fade {
  0%,
  100% { opacity: 1; }
  50% { opacity: 0.45; }
}
</style>
