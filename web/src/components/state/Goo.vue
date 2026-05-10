<!-- web/src/components/state/Goo.vue -->
<template>
  <svg
    :class="{ 's99ab-goo--dense': dense }"
    :width="size"
    :height="height"
    :viewBox="VIEW_BOX"
    :style="TRAVEL_STYLE"
    class="s99ab-goo"
    aria-hidden="true"
  >
    <defs>
      <!-- A per-instance id; useId is stable across server and client. -->
      <filter :id="filterId">
        <feGaussianBlur
          in="SourceGraphic"
          :stdDeviation="BLUR"
          result="blur"
        />
        <!-- An alpha ramp steep enough that only the blur overlap passes,
             with a negative offset for a hard edge. -->
        <feColorMatrix
          in="blur"
          mode="matrix"
          values="1 0 0 0 0  0 1 0 0 0  0 0 1 0 0  0 0 0 20 -8"
        />
      </filter>
    </defs>

    <g :filter="`url(#${filterId})`">
      <circle
        :cx="CX_A"
        :cy="CY"
        :r="R"
        class="s99ab-goo__ball s99ab-goo__ball--a"
      />
      <circle
        :cx="CX_B"
        :cy="CY"
        :r="R"
        class="s99ab-goo__ball s99ab-goo__ball--b"
      />
    </g>
  </svg>
</template>

<script setup lang="ts">
import { computed, useId } from 'vue'

// Two balls that meet, merge and part. The merge is an SVG blur plus alpha
// ramp; CSS contrast() would grey out a transparent ground. One `size` scales all.
const { size, dense = false } = defineProps<{
  /** Width in px, as a one-off override of $goo-size in styles/_config.scss. */
  size?: number | string
  /** The smaller size, $goo-size-dense, for a row of ordinary height. */
  dense?: boolean
}>()

// The geometry, with the travel exported as a custom property for the
// keyframes. At mid-cycle the balls overlap by 2 * (GAP - TRAVEL).
const BOX_W = 100
const BOX_H = 40
const R = 12
const GAP = 30
const TRAVEL = 28
const BLUR = 6

const CY = BOX_H / 2
const CX_A = BOX_W / 2 - GAP
const CX_B = BOX_W / 2 + GAP
const VIEW_BOX = `0 0 ${BOX_W} ${BOX_H}`
const TRAVEL_STYLE = { '--s99ab-goo-travel': `${TRAVEL}px` }

const filterId = `s99ab-goo-${useId()}`

// A width attribute only when a size is given, so the stylesheet sizes it otherwise.
const height = computed(() => {
  if (size === undefined) return undefined
  const n = typeof size === 'number' ? size : Number.parseFloat(size)
  return Number.isFinite(n) ? (n * BOX_H) / BOX_W : undefined
})
</script>
