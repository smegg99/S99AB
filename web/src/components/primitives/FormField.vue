<!-- web/src/components/primitives/FormField.vue -->
<template>
  <div
    class="form-field"
    :class="{ 'form-field--wide': wide }"
  >
    <span class="form-field__label">{{ label }}</span>
    <div class="form-field__control">
      <slot />
    </div>
    <span
      v-if="description"
      class="form-field__desc"
    >{{ description }}</span>
  </div>
</template>

<script setup lang="ts">
// A field with its label above, for a settings grid. `wide` spans both columns.
defineProps<{
  label?: string
  description?: string
  wide?: boolean
}>()
</script>

<style scoped>
.form-field {
  display: flex;
  flex-direction: column;
  gap: 4px;
  min-width: 0;
}

.form-field--wide {
  grid-column: 1 / -1;
}

.form-field__label {
  color: rgb(var(--v-theme-ink));
  font-size: 0.8125rem;
  font-weight: 600;
  line-height: 1.2;
}

/* The control fills the column, so every field down a column shares one width. */
.form-field__control :deep(.v-input) {
  width: 100%;
}

.form-field__desc {
  color: rgb(var(--v-theme-ink3));
  font-size: 0.75rem;
  line-height: 1.3;
}
</style>
