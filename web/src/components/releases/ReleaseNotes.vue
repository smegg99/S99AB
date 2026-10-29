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

// pl-PL reads pl notes: only the language part is compared.
const language = (tag: string) => tag.toLowerCase().split(/[-_]/)[0]
const untranslated = computed(() => Boolean(notesLocale) && language(notesLocale) !== language(locale.value))
const untranslatedText = computed(() =>
  t('release.notTranslated', 'These notes have not been translated.'),
)
</script>
