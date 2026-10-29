<!-- web/src/components/primitives/PageHeader.vue -->
<template>
  <header class="ph d-flex flex-wrap align-end">
    <div class="ph__text s99ab-on-ground flex-grow-1">
      <span
        v-if="eyebrow"
        class="s99ab-eyebrow"
      >{{ eyebrow }}</span>

      <h1 class="ph__title">
        {{ title }}
      </h1>

      <p
        v-if="lead"
        class="ph__lead"
      >
        {{ lead }}
      </p>
    </div>

    <div
      v-if="$slots.actions"
      class="ph__actions s99ab-controls"
    >
      <slot name="actions" />
    </div>
  </header>
</template>

<script setup lang="ts">
// A page's title and lead sentence. Both are text, not i18n keys: the app owns
// its namespace.
defineProps<{
  title: string
  /** Small tracked capitals above the title: the section this page is in. */
  eyebrow?: string
  lead?: string
}>()
defineSlots<{ actions?: () => unknown }>()
</script>

<style scoped>
/* Utilities cannot set two different gaps on the two axes. */
.ph {
  gap: var(--s99ab-pad-tight) var(--s99ab-gap);
}

/* min-width 0 so a long title ellipses instead of pushing the actions off. */
.ph__text {
  min-width: 0;
}

/* Set here, since a page may still hold an h1 elsewhere. */
.ph__title {
  margin: 2px 0 0;
  color: rgb(var(--v-theme-ink));
  font-size: var(--s99ab-page-title-size);
  font-weight: 650;
  letter-spacing: -0.022em;
  line-height: 1.14;
}

/* Held to a measure, a step below body size. The colour is inherited, taking
   full ink from .s99ab-on-ground; size and weight set the hierarchy. */
.ph__lead {
  max-width: var(--s99ab-measure);
  margin: var(--s99ab-control-gap) 0 0;
  font-size: var(--s99ab-page-lead-size);
  line-height: 1.55;
}

/* Heights and gap come from .s99ab-controls; this keeps the actions from taking the slack. */
.ph__actions {
  flex: 0 0 auto;
}
</style>
