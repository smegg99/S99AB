<!-- web/src/components/shell/Page.vue -->
<template>
  <div
    class="s99ab-page"
    :class="{ 's99ab-page--stack': stack }"
  >
    <slot />
  </div>
</template>

<script setup lang="ts">
/**
 * The root element of a routed page. Vue cannot animate a fragment, so a page
 * without one root skips `pageTransition`. Carries the page gap as well.
 */
const { stack = true } = defineProps<{
  /** Off for a screen that places its own children, such as a split view. */
  stack?: boolean
}>()
</script>

<style scoped>
/* The shell's container already supplies padding and the width cap. */
.s99ab-page--stack {
  display: flex;
  flex-direction: column;
  gap: var(--s99ab-gap);
}
</style>
