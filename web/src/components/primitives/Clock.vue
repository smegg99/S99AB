<!-- web/src/components/primitives/Clock.vue -->
<template>
  <time
    class="s99ab-clock"
    :datetime="reading"
  >
    <!-- Read once, whole. The drums below hold two digits mid-turn, which a
         screen reader would read as both. -->
    <span class="d-sr-only">{{ reading }}</span>
    <span
      class="s99ab-clock__face"
      aria-hidden="true"
    >
      <template
        v-for="(char, i) in reading"
        :key="i"
      >
        <span v-if="char === ':'">:</span>
        <span
          v-else
          class="s99ab-clock__drum"
        >
          <Transition
            name="s99ab-clock-roll"
            @enter-cancelled="hide"
          >
            <span
              :key="char"
              class="s99ab-clock__digit"
            >{{ char }}</span>
          </Transition>
        </span>
      </template>
    </span>
  </time>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { useNow } from '../../composables/primitives/useNow'
import { clock } from '../../browser/time'

const now = useNow()
const reading = computed(() => clock(now.value))

// A digit replaced mid-transition is hidden, since Vue's enter step would reset its angle a frame later and swing it back.
const hide = (el: Element) => {
  (el as HTMLElement).style.visibility = 'hidden'
}
</script>

<style scoped>
/* Registered so it can be animated; a plain custom property jumps. */
@property --s99ab-clock-turn {
  syntax: '<angle>';
  inherits: false;
  initial-value: 0deg;
}

/* Tabular figures set here, since the clock can sit anywhere. */
.s99ab-clock {
  --s99ab-clock-track: -0.02em;

  display: block;
  color: rgb(var(--v-theme-ink));
  font-size: var(--s99ab-clock-size, 80px);
  font-variant-numeric: tabular-nums;
  font-weight: var(--s99ab-clock-weight, 500);
  letter-spacing: var(--s99ab-clock-track);
  line-height: 1;
  white-space: nowrap;
}

.s99ab-clock__face {
  display: inline-flex;
}

/* Tracking moves to the margin so the drum window does not clip the digit. */
.s99ab-clock__drum {
  display: inline-grid;
  overflow: hidden;
  margin-inline-end: var(--s99ab-clock-track);
  letter-spacing: 0;
}

/* A drum digit from one animated angle with 2D transforms, so no 3D compositing layer is needed. */
.s99ab-clock__digit {
  grid-area: 1 / 1;
  opacity: calc(0.2 + 0.8 * cos(var(--s99ab-clock-turn)));
  transform: translateY(calc(-0.5em * sin(var(--s99ab-clock-turn)))) scaleY(cos(var(--s99ab-clock-turn)));
}

.s99ab-clock-roll-enter-active,
.s99ab-clock-roll-leave-active {
  transition: --s99ab-clock-turn var(--s99ab-clock-roll, 450ms) var(--s99ab-motion-easing);
}

.s99ab-clock-roll-enter-from {
  --s99ab-clock-turn: 90deg;
}

.s99ab-clock-roll-leave-to {
  --s99ab-clock-turn: -90deg;
}

/* The document carries the unresolved motion level, so 'system' is answered by the media query (as in auth/Steps.vue). */
:root[data-motion='reduced'] .s99ab-clock-roll-enter-active,
:root[data-motion='reduced'] .s99ab-clock-roll-leave-active,
:root[data-motion='off'] .s99ab-clock-roll-enter-active,
:root[data-motion='off'] .s99ab-clock-roll-leave-active {
  transition: none;
}

@media (prefers-reduced-motion: reduce) {
  :root[data-motion='system'] .s99ab-clock-roll-enter-active,
  :root[data-motion='system'] .s99ab-clock-roll-leave-active {
    transition: none;
  }
}
</style>
