<!-- web/src/components/primitives/FormSection.vue -->
<template>
  <section class="form-section">
    <header
      v-if="title || description || slots.head"
      class="form-section__head"
    >
      <slot name="head">
        <span
          v-if="title"
          class="form-section__title"
        >{{ title }}</span>
        <span
          v-if="description"
          class="form-section__desc"
        >{{ description }}</span>
      </slot>
    </header>

    <div class="form-section__grid">
      <slot />
    </div>
  </section>
</template>

<script setup lang="ts">
import { useSlots } from 'vue'

// A titled group of settings in a two-column grid of UiFormField and UiFormRow.
defineProps<{
  title?: string
  description?: string
}>()

const slots = useSlots()
</script>

<style scoped>
.form-section {
  display: flex;
  flex-direction: column;
}

/* More space between sections than between fields. */
.form-section + .form-section {
  margin-top: var(--s99ab-page-y);
}

.form-section__head {
  margin-bottom: var(--s99ab-gap);
}

/* Uppercase label over a full-width hairline. */
.form-section__title {
  display: block;
  padding-bottom: 6px;
  border-bottom: 1px solid rgb(var(--v-theme-line));
  color: rgb(var(--v-theme-ink3));
  font-size: 0.72rem;
  font-weight: 700;
  letter-spacing: 0.08em;
  text-transform: uppercase;
}

.form-section__desc {
  display: block;
  margin-top: 4px;
  color: rgb(var(--v-theme-ink3));
  font-size: 0.8125rem;
  line-height: 1.35;
}

/* Two columns, full column gap, tighter row gap. `wide` fields span both;
   align-items: start keeps a short toggle from stretching. */
.form-section__grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: var(--s99ab-control-gap) var(--s99ab-gap);
  align-items: start;
}

/* One column when there is no room for two. */
@media (max-width: 48rem) {
  .form-section__grid {
    grid-template-columns: 1fr;
  }
}
</style>
