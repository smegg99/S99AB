<!-- web/src/components/auth/KratosNode.vue -->
<template>
  <!-- The CSRF token and earlier step values, submitted verbatim. -->
  <input
    v-if="kind === 'hidden'"
    :name="node.attributes.name"
    :value="node.attributes.value"
    type="hidden"
  >

  <v-checkbox
    v-else-if="kind === 'checkbox'"
    :model-value="checked"
    :name="node.attributes.name"
    :label="label"
    :error-messages="errors"
    :messages="hints"
    :disabled="node.attributes.disabled"
    density="compact"
    @update:model-value="onCheck"
  />

  <v-text-field
    v-else-if="kind === 'field'"
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
    @update:model-value="onInput"
  >
    <!-- A real button, since append-inner-icon has no accessible name or tab
         stop. tabindex -1 keeps it out of the tab order between fields. -->
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

  <!-- Full width, safe because the form is capped at --s99ab-auth-w. -->
  <UiButton
    v-else-if="kind === 'submit'"
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

  <!-- type="button": the node's onclick (such as a WebAuthn ceremony) is the
       app's to run, and submitting would skip it. -->
  <v-btn
    v-else-if="kind === 'button'"
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

  <!-- Kratos links (resend code, back to sign in, recovery). A text button, so
       it matches the column without reading as a second action. -->
  <v-btn
    v-else-if="kind === 'anchor'"
    :href="node.attributes.href"
    block
    class="s99ab-auth-node__link"
    variant="text"
  >
    {{ node.attributes.title?.text ?? label }}
  </v-btn>

  <!-- Not rendered: injecting a script from a response body is what CSP
       prevents. An app wanting passkeys handles the emitted event. -->
  <template v-else-if="kind === 'script'" />

  <!-- Anything unrecognised is reported. -->
  <template v-else />
</template>

<script setup lang="ts">
import { computed, ref, watchEffect } from 'vue'
import UiButton from '../primitives/Button.vue'
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

/**
 * One node of a Kratos flow. Every node type Kratos sends is either rendered
 * here or reported.
 */
const { node, value = '', errors = [], hints = [], submitting = false } = defineProps<{
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

const kind = computed(() => kratosNodeKind(node))
const label = computed(() => kratosLabel(node, t))

// Password reveal is per field and per screen, never remembered.
const isPassword = computed(() => kratosInputType(node) === 'password')
const revealed = ref(false)

const fieldType = computed(() =>
  isPassword.value && revealed.value ? 'text' : kratosInputType(node))

// aria-pressed carries the state, so the label stays the same.
const revealLabel = computed(() => t('auth.showPassword', 'Show password'))

// Validated on blur. Kratos still validates on submit.
const rules = computed(() => kratosRules(node, t, kratosConfig.identifierIsEmail))

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
