<!-- web/src/components/auth/KratosNode.vue -->
<template>
  <!-- The CSRF token and earlier step values, submitted verbatim. -->
  <input
    v-if="kind === 'hidden'"
    :name="node.attributes.name"
    :value="node.attributes.value"
    type="hidden"
  >

  <UiDisabledHint
    v-else-if="kind === 'checkbox'"
    :reason="disabledReason"
    :label="label"
    block
  >
    <v-checkbox
      :model-value="checked"
      :name="node.attributes.name"
      :label="label"
      :error-messages="errors"
      :messages="hints"
      :disabled="node.attributes.disabled"
      density="compact"
      hide-details="auto"
      @update:model-value="onCheck"
    />
  </UiDisabledHint>

  <UiDisabledHint
    v-else-if="kind === 'field'"
    :reason="disabledReason"
    :label="label"
    block
  >
    <v-text-field
      ref="field"
      :model-value="text"
      :name="node.attributes.name"
      :label="label"
      :type="fieldType"
      :autocomplete="kratosAutocomplete(node)"
      :inputmode="kratosInputMode(node)"
      :required="node.attributes.required"
      :disabled="node.attributes.disabled"
      :error-messages="errors"
      :messages="hints"
      :rules="rules"
      validate-on="blur"
      variant="outlined"
      hide-details="auto"
      @update:model-value="onInput"
    >
      <!-- A button, since append-inner-icon has no accessible name.
           tabindex -1 keeps it out of the tab order between fields. -->
      <template
        v-if="isPassword"
        #append-inner
      >
        <v-btn
          :icon="revealed ? 'mdi-eye-off-outline' : 'mdi-eye-outline'"
          :aria-label="revealLabel"
          :aria-pressed="revealed"
          :title="revealLabel"
          variant="text"
          size="small"
          tabindex="-1"
          @click="revealed = !revealed"
        />
      </template>
    </v-text-field>
  </UiDisabledHint>

  <!-- Full width, safe because the form is capped at --s99ab-auth-w. -->
  <UiDisabledHint
    v-else-if="kind === 'submit'"
    :reason="submitting ? pendingLabel : disabledReason"
    :label="label"
    block
  >
    <UiButton
      :name="node.attributes.name"
      :value="String(node.attributes.value ?? '')"
      :disabled="node.attributes.disabled || submitting"
      :loading="submitting && isKratosPrimary(node)"
      :color="isKratosPrimary(node) ? 'accent' : undefined"
      :variant="isKratosPrimary(node) ? 'flat' : 'text'"
      block
      type="submit"
    >
      {{ label }}
    </UiButton>
  </UiDisabledHint>

  <!-- type="button": the node's onclick (such as a WebAuthn ceremony) is the
       app's to run, and submitting would skip it. -->
  <UiDisabledHint
    v-else-if="kind === 'button'"
    :reason="disabledReason"
    :label="label"
    block
  >
    <v-btn
      :name="node.attributes.name"
      :value="String(node.attributes.value ?? '')"
      :disabled="node.attributes.disabled"
      type="button"
      variant="tonal"
      block
      @click="emit('run', node)"
    >
      {{ label }}
    </v-btn>
  </UiDisabledHint>

  <!-- The TOTP QR code, sent by Kratos as a data URI. -->
  <img
    v-else-if="kind === 'image'"
    :src="node.attributes.src"
    :width="node.attributes.width"
    :height="node.attributes.height"
    :alt="label"
    class="s99ab-auth-node__image"
  >

  <!-- Recovery codes and lookup secrets: monospaced and selectable. -->
  <pre
    v-else-if="kind === 'text'"
    class="s99ab-auth-node__text"
  >{{ label }}</pre>

  <!-- Kratos links (resend code, back to sign in, recovery). -->
  <v-btn
    v-else-if="kind === 'anchor'"
    :href="node.attributes.href"
    block
    class="s99ab-auth-node__link"
    variant="text"
  >
    {{ node.attributes.title?.text ?? label }}
  </v-btn>

  <!-- Not rendered (CSP); an app wanting passkeys handles the emitted event. -->
  <template v-else-if="kind === 'script'" />

  <!-- Anything unrecognised is reported. -->
  <template v-else />
</template>

<script setup lang="ts">
import { computed, ref, useTemplateRef, watch, watchEffect } from 'vue'
import UiButton from '../primitives/Button.vue'
import UiDisabledHint from '../primitives/DisabledHint.vue'
import {
  isKratosPrimary,
  kratosAutocomplete,
  kratosInputMode,
  kratosInputType,
  kratosLabel,
  kratosNodeKind,
} from '../../composables/kratos/internal/nodes'
import { kratosRules } from '../../composables/kratos/internal/rules'
import { config as kratosConfig } from '../../composables/kratos/internal/types'
import { useTranslate } from '../../composables/useTranslate'
import type { KratosNode } from '../../composables/kratos/internal/types'

/** One node of a Kratos flow; every node type is rendered or reported. */
const { node, value = '', errors = [], hints = [], submitting } = defineProps<{
  node: KratosNode
  /** From the flow's value map. */
  value?: string
  errors?: string[]
  hints?: string[]
  submitting?: boolean
}>()

const emit = defineEmits<{
  'update:value': [value: string]
  /** A button node was pressed. The app runs its `onclick`. */
  'run': [node: KratosNode]
  /** A node this component cannot render. */
  'unsupported': [node: KratosNode]
}>()

const t = useTranslate()
const pendingLabel = computed(() => t('auth.pending', 'Wait for the sign-in request to finish.'))

const kind = computed(() => kratosNodeKind(node))
const label = computed(() => kratosLabel(node, t))
const disabledReason = computed(() => node.attributes.disabled ? errors.join(' ') || t('auth.disabled') : '')

// Password reveal is per field and per screen, never remembered.
const isPassword = computed(() => kratosInputType(node) === 'password')
const revealed = ref(false)

const fieldType = computed(() =>
  isPassword.value && revealed.value ? 'text' : kratosInputType(node))

// aria-pressed carries the state, so the label stays the same.
const revealLabel = computed(() => t('auth.showPassword', 'Show password'))

// Validated on blur. Kratos still validates on submit.
const rules = computed(() => kratosRules(node, t, kratosConfig.identifierIsEmail))

// Vuetify keeps a shown rule message across a locale change; revalidate only fields showing one.
const field = useTemplateRef<{ errorMessages: string[], validate: () => Promise<string[]> }>('field')
watch(rules, () => {
  if (field.value?.errorMessages.length) void field.value.validate()
})

const text = computed(() => value)
// A boolean trait's state is sent and returned as the value.
const checked = computed(() => value === 'true')

function onInput(next: string) {
  emit('update:value', next)
}

function onCheck(next: boolean | null) {
  emit('update:value', next ? 'true' : 'false')
}

// Reported once per node. `script` is reported separately as understood but declined.
watchEffect(() => {
  if (kind.value !== 'unknown' && kind.value !== 'script') return

  emit('unsupported', node)
  if (typeof console !== 'undefined') {
    console.warn(
      `[s99ab] Kratos sent a "${node.type}" node this form does not render`
      + ` (group "${node.group}"). The flow cannot be completed as shown.`,
    )
  }
})
</script>
