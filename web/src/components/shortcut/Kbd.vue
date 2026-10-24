<!-- web/src/components/shortcut/Kbd.vue -->
<template>
  <kbd class="kbd">{{ pretty }}</kbd>
</template>

<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { isMac } from '../../composables/useShortcut'
import { useTranslate } from '../../composables/useTranslate'

// A key cap. Resolves `mod` to Cmd on macOS and Ctrl elsewhere.
const { keys } = defineProps<{
  /** A shortcut in registry form: `mod+k`, `shift+?`, `alt+ArrowUp`. */
  keys: string
}>()

// Resolved after mount: isMac() is false on the server, so reading it in render breaks hydration.
const mac = ref(false)

const t = useTranslate()

// Letters uppercase; named keys via shortcut.key.<name>, else capitalised.
function cap(part: string): string {
  if (part === 'mod') return mac.value ? 'Cmd' : t('shortcut.key.ctrl', 'Ctrl')
  if (part.length === 1) return part.toUpperCase()
  const name = part.toLowerCase()
  return t(`shortcut.key.${name}`, name.charAt(0).toUpperCase() + name.slice(1))
}

const pretty = computed(() => keys.split('+').map(cap).join(' + '))

onMounted(() => {
  mac.value = isMac()
})
</script>

<style scoped>
/* The heavier bottom border draws the key's lip without a shadow. */
.kbd {
  transform: translateZ(0);
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
