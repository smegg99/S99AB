<!-- web/src/components/shortcut/Kbd.vue -->
<template>
  <kbd class="kbd">{{ pretty }}</kbd>
</template>

<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { isMac } from '../../composables/useShortcut'

// A key cap. Resolves `mod` to Cmd on macOS and Ctrl elsewhere.
const { keys } = defineProps<{
  /** A shortcut in registry form: `mod+k`, `shift+?`, `alt+ArrowUp`. */
  keys: string
}>()

// The platform is read after mount, so server and client render the same
// markup before the client updates.
const mac = ref(false)

const pretty = computed(() =>
  keys
    .split('+')
    .map(part => (part === 'mod' ? (mac.value ? 'Cmd' : 'Ctrl') : part))
    .join(' + '),
)

onMounted(() => {
  mac.value = isMac()
})
</script>

<style scoped>
/* No Vuetify component draws a key cap. The heavier bottom border marks the
   key's lip without a shadow. */
.kbd {
  display: inline-block;
  padding: 1px var(--s99ab-control-gap);
  border: 1px solid rgb(var(--v-theme-edge));
  border-bottom-width: 2px;
  border-radius: var(--s99ab-radius);
  background: rgb(var(--v-theme-raised));
  color: rgb(var(--v-theme-ink2));
  font-family: var(--s99ab-font-mono);
  font-size: var(--s99ab-label-size);
  line-height: 1.5;
  white-space: nowrap;
}
</style>
