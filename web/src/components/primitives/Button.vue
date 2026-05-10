<!-- web/src/components/primitives/Button.vue -->
<template>
  <v-btn class="s99ab-btn">
    <!-- The layer's loader, wrapped so it centres on the label. -->
    <template #loader>
      <span class="s99ab-btn__loader">
        <slot name="loader">
          <UiGoo />
        </slot>
      </span>
    </template>

    <!-- Other slots pass through, only those given, so v-btn reserves no
         room for an empty prepend. -->
    <template
      v-for="name in forwarded"
      :key="name"
      #[name]="slotProps"
    >
      <slot
        :name="name"
        v-bind="slotProps ?? {}"
      />
    </template>
  </v-btn>
</template>

<script setup lang="ts">
import { computed, useSlots } from 'vue'
import UiGoo from '../state/Goo.vue'

/**
 * v-btn with the layer's goo loader. Every v-btn attribute falls through,
 * including `aria-busy`, which v-btn sets from `loading`.
 */

const slots = useSlots()

// `loader` is in the template, so a caller's own loader lands inside the wrapper.
const forwarded = computed(() => Object.keys(slots).filter(name => name !== 'loader'))
</script>
