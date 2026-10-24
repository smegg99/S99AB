<!-- web/src/components/overlay/ConfirmDialog.vue -->
<template>
  <UiDialogCard :title="options.title">
    <p
      v-if="options.body"
      class="s99ab-dialog__text"
    >
      {{ options.body }}
    </p>
    <template #actions>
      <v-btn
        variant="text"
        @click="close(false)"
      >
        {{ cancelText }}
      </v-btn>
      <!-- Flat, to set it apart from cancel. -->
      <v-btn
        :color="options.confirmColor ?? 'accent'"
        variant="flat"
        @click="close(true)"
      >
        {{ confirmText }}
      </v-btn>
    </template>
  </UiDialogCard>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import UiDialogCard from './DialogCard.vue'
import type { ConfirmOptions } from '../../composables/useDialog'
import { useDialog } from '../../composables/useDialog'
import { useTranslate } from '../../composables/useTranslate'

const { options } = defineProps<{ options: ConfirmOptions }>()

const { close } = useDialog<boolean>()
const t = useTranslate()

const confirmText = computed(() => options.confirmLabel ?? t('common.confirm', 'Confirm'))
const cancelText = computed(() => options.cancelLabel ?? t('common.cancel', 'Cancel'))
</script>
