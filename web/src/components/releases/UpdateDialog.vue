<!-- web/src/components/releases/UpdateDialog.vue -->
<template>
  <UiDialogCard :title="title">
    <p class="s99ab-dialog__text">
      {{ body }}
    </p>
    <template #start>
      <v-btn
        variant="text"
        @click="close('ignore')"
      >
        {{ t('release.updateIgnore', 'Ignore this version') }}
      </v-btn>
    </template>
    <template #actions>
      <v-btn
        variant="text"
        @click="close('later')"
      >
        {{ t('release.updateLater', 'Later') }}
      </v-btn>
      <v-btn
        color="accent"
        variant="flat"
        @click="close('download')"
      >
        {{ t('release.updateDownload', 'Download') }}
      </v-btn>
    </template>
  </UiDialogCard>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import UiDialogCard from '../overlay/DialogCard.vue'
import { useDialog } from '../../composables/useDialog'
import { useTranslate } from '../../composables/useTranslate'

const { current, latest } = defineProps<{ current: string, latest: string }>()
const { close } = useDialog<UpdateChoice>()
const t = useTranslate()
const title = computed(() => t('release.updateTitle', 'A newer version is available'))
const body = computed(() => t('release.updateBody', 'You have {current}. The newest is {latest}.', { current, latest }))
</script>

<script lang="ts">
export type UpdateChoice = 'download' | 'ignore' | 'later'
</script>
