<!-- web/src/components/auth/BrandMark.vue -->
<template>
  <svg
    :width="size"
    :height="size"
    class="mark"
    viewBox="0 0 48 48"
    aria-hidden="true"
  >
    <!-- Three planes edge-on, back to front. One path per plane, so each keeps
         its own opacity. -->
    <path
      class="mark__plane mark__plane--back"
      d="M24 6 44 16 24 26 4 16Z"
    />
    <path
      class="mark__plane mark__plane--mid"
      d="M24 18 44 28 24 38 4 28Z"
    />
    <path
      class="mark__plane mark__plane--front"
      d="M24 26 44 36 24 46 4 36Z"
    />
  </svg>
</template>

<script setup lang="ts">
// The layer's placeholder mark, drawn by UiAuthCard when an app passes no
// #brand. Inline SVG, so it takes the app's accent.
const { size = 56 } = defineProps<{ size?: number | string }>()
</script>

<style scoped>
/* The planes overlap; the alpha ramp separates them. */
.mark {
  display: block;
  flex: 0 0 auto;
}

.mark__plane {
  fill: rgb(var(--v-theme-accent));
}

/* Front to back, dimming with distance. Alphas of the accent, not separate colours. */
.mark__plane--front {
  opacity: 1;
}

.mark__plane--mid {
  opacity: 0.55;
}

.mark__plane--back {
  opacity: 0.28;
}
</style>
