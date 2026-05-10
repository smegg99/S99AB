<!-- web/src/components/primitives/Stat.vue -->
<template>
  <div class="stat d-flex flex-column">
    <div class="s99ab-eyebrow">
      {{ label }}
    </div>

    <span class="stat__value num">
      <slot>{{ value }}</slot>
      <span
        v-if="unit"
        class="stat__unit"
      >{{ unit }}</span>
    </span>

    <span
      v-if="hint"
      class="stat__hint"
    >{{ hint }}</span>
  </div>
</template>

<script setup lang="ts">
// One number and its meaning, in tabular figures (the `num` class) since values are often live.
defineProps<{
  label: string
  value?: string | number
  /** Shown smaller beside the value: ms, MB, %. */
  unit?: string
  hint?: string
}>()
</script>

<style scoped>
/* The column's hairline gap and the weights. Sizes are $stat-* in styles/_config.scss. */
.stat {
  gap: 2px;
  min-width: 0;
}

.stat__value {
  display: flex;
  align-items: baseline;
  gap: 4px;
  color: rgb(var(--v-theme-ink));
  font-size: var(--s99ab-stat-value-size);
  font-weight: 650;
  letter-spacing: -0.02em;
  line-height: var(--s99ab-stat-value-lh);
}

.stat__unit {
  color: rgb(var(--v-theme-ink3));
  font-size: var(--s99ab-stat-unit-size);
  font-weight: 600;
  letter-spacing: 0;
}

.stat__hint {
  color: rgb(var(--v-theme-ink3));
  font-size: var(--s99ab-stat-hint-size);
  line-height: 1.4;
}
</style>
