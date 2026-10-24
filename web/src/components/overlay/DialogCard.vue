<!-- web/src/components/overlay/DialogCard.vue -->
<template>
  <!-- Every dialog's frame. Commit and dismiss go in #actions; another action
       (a remove beside a rename) goes in #start. -->
  <UiPanel
    :title="title"
    class="s99ab-dialog"
  >
    <div
      v-if="$slots.default"
      class="s99ab-dialog__body"
    >
      <slot />
    </div>
    <div
      v-if="$slots.actions || $slots.start"
      class="s99ab-dialog__actions"
    >
      <slot name="start" />
      <span class="s99ab-dialog__spacer" />
      <slot name="actions" />
    </div>
  </UiPanel>
</template>

<script setup lang="ts">
import UiPanel from '../primitives/Panel.vue'

defineProps<{
  /** Also the host's accessible name. */
  title?: string
}>()
</script>
