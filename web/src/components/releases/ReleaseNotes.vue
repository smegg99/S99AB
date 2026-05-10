<!-- web/src/components/releases/ReleaseNotes.vue -->
<template>
  <template v-if="notes">
    <!-- Notes are in another language because none matched the user's. -->
    <v-alert
      v-if="untranslated"
      :text="untranslatedText"
      type="info"
      variant="tonal"
      density="compact"
      class="mb-4"
    />

    <UiMarkdown :source="notes" />
  </template>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import UiMarkdown from '../markdown/Markdown.vue'
import { useLocale, useTranslate } from '../../composables/useTranslate'

// Rendered as text, never HTML; see UiMarkdown.
const { notes, notesLocale = '' } = defineProps<{
  notes: string
  /** The language of `notes`, as the API resolved it. */
  notesLocale?: string
}>()

const t = useTranslate()
const locale = useLocale()

const untranslated = computed(() => Boolean(notesLocale) && notesLocale !== locale.value)
const untranslatedText = computed(() =>
  t('release.notTranslated', 'These notes are not available in your language yet.'),
)
</script>
