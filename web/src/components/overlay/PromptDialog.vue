<!-- web/src/components/overlay/PromptDialog.vue -->
<template>
  <v-card>
    <v-card-title>{{ options.title }}</v-card-title>

    <v-card-text v-if="options.body">
      {{ options.body }}
    </v-card-text>

    <v-card-text>
      <v-text-field
        v-model="draft"
        :label="fieldLabel"
        :rules="options.rules"
        autofocus
        @keyup.enter="submit()"
      />
    </v-card-text>

    <v-card-actions>
      <v-spacer />
      <v-btn
        variant="text"
        @click="close()"
      >
        {{ cancelText }}
      </v-btn>
      <!-- Flat; see ConfirmDialog. -->
      <v-btn
        :disabled="!valid"
        color="accent"
        variant="flat"
        @click="submit()"
      >
        {{ confirmText }}
      </v-btn>
    </v-card-actions>
  </v-card>
</template>

<script setup lang="ts">
import { computed, ref } from 'vue'
import type { PromptOptions } from '../../composables/useDialog'
import { useDialog } from '../../composables/useDialog'
import { useTranslate } from '../../composables/useTranslate'

const { options } = defineProps<{ options: PromptOptions }>()

const { close } = useDialog<string>()
const t = useTranslate()

const draft = ref(options.value ?? '')

// Fallback label, since the field is autofocused.
const fieldLabel = computed(() => options.label ?? t('common.value', 'Value'))
const confirmText = computed(() => options.confirmLabel ?? t('common.confirm', 'Confirm'))
const cancelText = computed(() => options.cancelLabel ?? t('common.cancel', 'Cancel'))
const valid = computed(() =>
  (options.rules ?? []).every(rule => rule(draft.value) === true),
)

// An empty draft is an answer; cancel is close() with no value.
function submit() {
  if (valid.value) close(draft.value)
}
</script>
