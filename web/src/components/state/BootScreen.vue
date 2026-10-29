<!-- web/src/components/state/BootScreen.vue -->
<template>
  <!-- The whole window while the app starts: the app's mark over the goo. A failure is UiCrashScreen's. -->
  <main
    class="s99ab-screen"
    role="status"
    aria-busy="true"
    :aria-label="label"
  >
    <slot name="logo" />
    <div class="s99ab-screen__figure">
      <UiGoo :size="200" />
    </div>
  </main>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import UiGoo from './Goo.vue'
import { useTranslate } from '../../composables/useTranslate'

const { app } = defineProps<{ app: string }>()
defineSlots<{ logo?: () => unknown }>()

const t = useTranslate()
const label = computed(() => t('crash.starting', 'Starting {app}', { app }))
</script>
