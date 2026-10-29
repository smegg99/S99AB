<!-- web/src/components/decor/Ticker.vue -->
<template>
  <div class="ticker">
    <div
      class="track"
      :style="{ animationDuration: `${seconds}s` }"
    >
      <ul
        v-for="copy in 2"
        :key="copy"
        class="run"
        :aria-hidden="copy === 2"
      >
        <li
          v-for="(m, i) in items"
          :key="`${copy}-${i}`"
          class="item"
        >
          <span class="mark" />
          {{ m }}
        </li>
      </ul>
    </div>
  </div>
</template>

<script setup lang="ts">
// A scrolling strip for short notices. Colour is inherited; --s99ab-ticker-mark
// tints the separator. The track holds the list twice and slides half its width
// for a seamless loop; the second copy is hidden from screen readers.
const { items, seconds = 44 } = defineProps<{
  items: string[]
  seconds?: number
}>()
</script>

<style scoped lang="scss">
.ticker {
  overflow: hidden;
  // Fades the ends while sliding.
  mask-image: linear-gradient(90deg, transparent, #000 40px, #000 calc(100% - 40px), transparent);
}

.track {
  display: flex;
  width: max-content;
  animation-name: run;
  animation-timing-function: linear;
  animation-iteration-count: infinite;
}

.ticker:hover .track { animation-play-state: paused; }

.run {
  display: flex;
  align-items: center;
  list-style: none;
  margin: 0;
  padding: 0;
  flex: none;
}

.item {
  display: flex;
  align-items: center;
  gap: 14px;
  padding-inline-end: 34px;
  font-size: 12px;
  color: inherit;
  white-space: nowrap;
}

// A drawn separator, so screen readers do not announce it.
.mark {
  width: 5px;
  height: 5px;
  background: var(--s99ab-ticker-mark, currentColor);
  flex: none;
}

// Half the track is one copy of the list, so the loop is seamless.
@keyframes run {
  from { transform: translateX(0); }
  to { transform: translateX(-50%); }
}
</style>
