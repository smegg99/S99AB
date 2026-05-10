<!-- web/src/components/overlay/ConfirmDialog.vue -->
<template>
  <v-card>
    <v-card-title>{{ options.title }}</v-card-title>

    <v-card-text v-if="options.body">
      {{ options.body }}
    </v-card-text>

    <v-card-actions>
      <v-spacer />
      <v-btn
        variant="text"
        @click="close(false)"
      >
        {{ cancelText }}
      </v-btn>
      <!-- Flat, since v-card-actions makes buttons text by default. -->
      <v-btn
        :color="options.confirmColor ?? 'accent'"
        variant="flat"
        @click="close(true)"
      >
        {{ confirmText }}
      </v-btn>
    </v-card-actions>
  </v-card>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import type { ConfirmOptions } from '../../composables/useDialog'
import { useDialog } from '../../composables/useDialog'
import { useTranslate } from '../../composables/useTranslate'

const { options } = defineProps<{ options: ConfirmOptions }>()

const { close } = useDialog<boolean>()
const t = useTranslate()

const confirmText = computed(() => options.confirmLabel ?? t('common.confirm', 'Confirm'))
const cancelText = computed(() => options.cancelLabel ?? t('common.cancel', 'Cancel'))
</script>
