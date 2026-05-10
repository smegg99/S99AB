<!-- web/src/components/primitives/FormRow.vue -->
<template>
  <div
    class="form-row"
    :class="{ 'form-row--wide': wide }"
  >
    <div class="form-row__text">
      <span class="form-row__label">{{ label }}</span>
      <span
        v-if="description"
        class="form-row__desc"
      >{{ description }}</span>
    </div>

    <div class="form-row__control">
      <slot />
    </div>
  </div>
</template>

<script setup lang="ts">
// A toggle setting: label and optional description on the left, a compact
// control on the right. `wide` spans both grid columns.
defineProps<{
  label?: string
  description?: string
  wide?: boolean
}>()
</script>

<style scoped>
.form-row {
  display: flex;
  align-items: center;
  gap: var(--s99ab-gap);
  min-height: var(--s99ab-control-h);
  min-width: 0;
}

.form-row--wide {
  grid-column: 1 / -1;
}

.form-row__text {
  display: flex;
  flex-direction: column;
  gap: 2px;
  flex: 1 1 auto;
  min-width: 0;
}

.form-row__label {
  color: rgb(var(--v-theme-ink));
  font-size: 0.8125rem;
  font-weight: 600;
}

.form-row__desc {
  color: rgb(var(--v-theme-ink3));
  font-size: 0.75rem;
  line-height: 1.3;
}

/* Natural width at the trailing edge. */
.form-row__control {
  flex: 0 0 auto;
}
</style>
