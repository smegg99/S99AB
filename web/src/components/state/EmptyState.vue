<!-- web/src/components/state/EmptyState.vue -->
<template>
  <div class="s99ab-state s99ab-state--center">
    <!-- Above the glyph, for a brand mark or an illustration. -->
    <slot name="prepend" />

    <v-icon
      :icon="icon"
      :size="iconSize"
      class="s99ab-state__icon"
    />

    <div class="s99ab-state__body">
      <!-- A heading for navigation; the level is left to the caller. -->
      <span
        class="s99ab-state__title"
        role="heading"
        aria-level="2"
      >{{ title }}</span>
      <p
        v-if="text"
        class="s99ab-state__text"
      >
        {{ text }}
      </p>
    </div>

    <div
      v-if="hasAction"
      class="s99ab-state__act"
    >
      <!-- One action is a label and an event; more go in the slot. A text
           button with accent ink; a dialog's confirm keeps its fill. -->
      <slot name="actions">
        <v-btn
          color="accent"
          variant="text"
          @click="emit('action')"
        >
          {{ actionLabel }}
        </v-btn>
      </slot>
    </div>

    <!-- A note after the actions. -->
    <slot name="append" />
  </div>
</template>

<script setup lang="ts">
import { computed, useSlots } from 'vue'

// Hand-rolled, since v-empty-state is sized for Material. The screen decides
// between filtered-empty and nothing-exists messages.
const { icon = 'mdi-tray-remove', actionLabel } = defineProps<{
  title: string
  text?: string
  icon?: string
  /** A one-off override; the default is $state-icon in styles/_config.scss. */
  iconSize?: number | string
  /** What fixes the emptiness, e.g. "Create the first item". */
  actionLabel?: string
}>()
const emit = defineEmits<{ action: [] }>()

defineSlots<{ prepend?: () => unknown, actions?: () => unknown, append?: () => unknown }>()

const slots = useSlots()

const hasAction = computed(() => Boolean(actionLabel) || Boolean(slots.actions))
</script>
