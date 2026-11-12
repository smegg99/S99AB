<!-- web/src/components/releases/ReleaseNotesDialog.vue -->
<template>
  <UiDialogCard
    :title="title"
    class="s99ab-release-notes-dialog"
  >
    <v-defaults-provider :defaults="{ VAlert: { icon: false } }">
      <UiReleaseNotes
        :notes="notes"
        :notes-locale="notesLocale"
      />
    </v-defaults-provider>
    <template #actions>
      <v-btn
        variant="text"
        @click="close()"
      >
        {{ t('common.close', 'Close') }}
      </v-btn>
    </template>
  </UiDialogCard>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import UiDialogCard from '../overlay/DialogCard.vue'
import UiReleaseNotes from './ReleaseNotes.vue'
import { useDialog } from '../../composables/useDialog'
import { useTranslate } from '../../composables/useTranslate'

const { version, notes, notesLocale } = defineProps<{ version: string, notes: string, notesLocale: string }>()
const { close } = useDialog()
const t = useTranslate()
const title = computed(() => t('release.notesTitle', 'What\'s new in {version}', { version }))
</script>
