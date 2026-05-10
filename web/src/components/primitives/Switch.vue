<!-- web/src/components/primitives/Switch.vue -->
<template>
  <v-switch
    v-model="model"
    class="s99ab-switch"
  >
    <!-- Passes through only the slots given, so unwritten ones reserve no room. -->
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
  </v-switch>
</template>

<script setup lang="ts">
import { computed, useSlots } from 'vue'

// The layer's switch; size and accent come from the theme DEFAULTS for VSwitch.
// The whole v-switch API falls through as attributes.
const model = defineModel<boolean>()

const slots = useSlots()
const forwarded = computed(() => Object.keys(slots))
</script>
