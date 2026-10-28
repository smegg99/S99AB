<!-- web/src/components/overlay/PromptDialog.vue -->
<template>
  <UiDialogCard :title="options.title">
    <p
      v-if="options.body"
      class="s99ab-dialog__text"
    >
      {{ options.body }}
    </p>
    <!-- The message row is always reserved, so a message shifts nothing. -->
    <v-text-field
      v-model="draft"
      :label="fieldLabel"
      :rules="options.rules"
      :error-messages="refused"
      :readonly="busy"
      autofocus
      @update:model-value="refused = ''"
      @keydown.enter.prevent="submit"
    />
    <template
      v-if="options.secondary"
      #start
    >
      <UiDisabledHint
        :reason="busy ? pendingText : ''"
        :label="options.secondary.label"
      >
        <v-btn
          variant="text"
          :color="options.secondary.color"
          :prepend-icon="options.secondary.icon"
          :disabled="busy"
          @click="secondary"
        >
          {{ options.secondary.label }}
        </v-btn>
      </UiDisabledHint>
    </template>
    <template #actions>
      <v-btn
        variant="text"
        :disabled="busy"
        @click="close()"
      >
        {{ cancelText }}
      </v-btn>
      <!-- Disabled reason: the first failing rule, or the pending save. -->
      <UiDisabledHint
        :reason="blocked"
        :label="confirmText"
      >
        <v-btn
          :disabled="busy || !valid"
          color="accent"
          variant="flat"
          @click="submit"
        >
          {{ confirmText }}
        </v-btn>
      </UiDisabledHint>
    </template>
  </UiDialogCard>
</template>

<script setup lang="ts">
import { computed, ref } from 'vue'
import UiDialogCard from './DialogCard.vue'
import UiDisabledHint from '../primitives/DisabledHint.vue'
import type { PromptOptions } from '../../composables/useDialog'
import { useDialog } from '../../composables/useDialog'
import { useTranslate } from '../../composables/useTranslate'

const { options } = defineProps<{ options: PromptOptions }>()

const { close, hold } = useDialog<string>()
const t = useTranslate()

const draft = ref(options.value ?? '')
/** The refusal from `submit` or `secondary`, shown under the field. */
const refused = ref('')
const busy = ref(false)

// Fallback label, since the field is autofocused.
const fieldLabel = computed(() => options.label ?? t('common.value', 'Value'))
const confirmText = computed(() => options.confirmLabel ?? t('common.confirm', 'Confirm'))
const cancelText = computed(() => options.cancelLabel ?? t('common.cancel', 'Cancel'))
const pendingText = computed(() => t('common.pending', 'Wait for it to finish.'))
const failedText = computed(() => t('error.unknown', 'Something went wrong.'))

/** The first failing rule's message, or true. */
const failed = computed(() => {
  for (const rule of options.rules ?? []) {
    const result = rule(draft.value)
    if (result !== true) return result
  }
  return true
})
const valid = computed(() => failed.value === true)
const blocked = computed(() => {
  if (busy.value) return pendingText.value
  return typeof failed.value === 'string' ? failed.value : ''
})

/**
 * Runs a save or the second action, holding the dialog open meanwhile. A refusal or a throw stays
 * under the field; success closes with `answer`.
 */
async function run(work: () => Promise<string | undefined>, answer?: string) {
  busy.value = true
  hold(true)
  let said: string | undefined
  try {
    said = await work()
  }
  catch {
    said = failedText.value
  }
  finally {
    busy.value = false
    hold(false)
  }
  if (said) refused.value = said
  else close(answer)
}

// An empty draft is an answer; cancel is close() with no value.
function submit() {
  if (busy.value || !valid.value) return
  const answer = draft.value
  if (options.submit) void run(() => options.submit!(answer), answer)
  else close(answer)
}

function secondary() {
  if (!busy.value && options.secondary) void run(options.secondary.run)
}
</script>
