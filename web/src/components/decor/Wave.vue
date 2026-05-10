<!-- web/src/components/decor/Wave.vue -->
<script setup lang="ts">
import { computed } from 'vue'

// Section edges. `crest` is one long swell, `ripple` two shorter ones.
type Variant = 'crest' | 'ripple'

// Paths close at y=140 below the 120 viewBox, so the antialiased fill edge is
// clipped. Amplitudes are large to survive preserveAspectRatio="none" stretching.
const PATHS: Record<Variant, string> = {
  crest: 'M0 58C259 8 461 8 720 58C979 108 1181 108 1440 58L1440 140L0 140Z',
  ripple: 'M0 56C130 16 230 16 360 56C490 96 590 96 720 56C850 16 950 16 1080 56C1210 96 1310 96 1440 56L1440 140L0 140Z',
}

const { variant = 'crest', flip = false, height = 72, stack = false } = defineProps<{
  variant?: Variant
  // Points the swell upward, for a band's bottom edge.
  flip?: boolean
  height?: number
  // Draws the other variant behind, shifted and faded.
  stack?: boolean
}>()

const d = computed(() => PATHS[variant])
const back = computed(() => PATHS[variant === 'crest' ? 'ripple' : 'crest'])
</script>

<template>
  <svg
    class="wave"
    :class="{ flip }"
    :style="{ height: `${height}px` }"
    viewBox="0 0 1440 120"
    preserveAspectRatio="none"
    aria-hidden="true"
    focusable="false"
  >
    <path
      v-if="stack"
      class="back"
      :d="back"
      fill="currentColor"
      transform="translate(-90 14)"
    />
    <path
      :d="d"
      fill="currentColor"
    />
  </svg>
</template>

<style scoped lang="scss">
// currentColor from the parent; block display avoids the inline half-pixel gap.
.wave {
  display: block;
  width: 100%;
}

.back { opacity: 0.4; }

.flip { transform: scaleY(-1); }
</style>
