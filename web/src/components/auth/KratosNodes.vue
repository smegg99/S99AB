<!-- web/src/components/auth/KratosNodes.vue -->
<template>
  <UiStack>
    <!-- Inside the stack, above the messages. -->
    <slot name="prepend" />

    <!-- Kratos messages, styled as layer notes instead of v-alert. -->
    <p
      v-for="message in messages"
      :key="message.id"
      :class="`s99ab-auth-note--${kratosSeverity(message)}`"
      class="s99ab-auth-note"
      :role="kratosSeverity(message) === 'error' ? 'alert' : 'status'"
    >
      <v-icon
        :icon="noteIcon(message)"
        size="18"
      />
      {{ textOf(message) }}
    </p>

    <!-- Nodes in Kratos's order; regrouping is the caller's choice. The scoped
         per-node slot lets a screen take over one node type. -->
    <template
      v-for="(node, i) in nodes"
      :key="nodeKey(node, i)"
    >
      <!-- `update` lets a slot write a value back; UiKratosNode is fully
           controlled, so without it the flow's value map would go stale. -->
      <slot
        :errors="errorsFor(node.attributes.name ?? '')"
        :hints="hintsFor(node.attributes.name ?? '')"
        :kind="kratosNodeKind(node)"
        :node="node"
        :submitting="submitting"
        :update="(next: string) => emit('update:value', node, next)"
        :value="valueOf(node)"
        name="node"
      >
        <UiKratosNode
          :node="node"
          :value="valueOf(node)"
          :errors="errorsFor(node.attributes.name ?? '')"
          :hints="hintsFor(node.attributes.name ?? '')"
          :submitting="submitting"
          @update:value="emit('update:value', node, $event)"
          @run="emit('run', $event)"
          @unsupported="emit('unsupported', $event)"
        />
      </slot>
    </template>

    <!-- Below the submit, for "or continue with" or a terms line. -->
    <slot name="append" />
  </UiStack>
</template>

<script setup lang="ts">
import UiKratosNode from './KratosNode.vue'
import UiStack from '../primitives/Stack.vue'
import { kratosNodeKind, kratosSeverity } from '../../composables/kratos/internal/nodes'
import { kratosMessageText } from '../../composables/kratos/internal/rules'
import { useTranslate } from '../../composables/useTranslate'
import type { KratosMessage, KratosNode } from '../../composables/kratos/internal/types'
import type { KratosNodeKind } from '../../composables/kratos/internal/nodes'

/**
 * A Kratos flow's messages and nodes, with no form element or flow lifecycle.
 * Writes come back as events, so the flow owner stays the only writer.
 */
const {
  nodes,
  messages = [],
  values = {},
  errorsFor = () => [],
  hintsFor = () => [],
  submitting,
} = defineProps<{
  nodes: readonly KratosNode[]
  /** Flow-level messages. Field-level ones come through errorsFor. */
  messages?: readonly KratosMessage[]
  /** Bound values by node name. */
  values?: Record<string, string>
  errorsFor?: (name: string) => string[]
  hintsFor?: (name: string) => string[]
  /** A step is in flight. */
  submitting?: boolean
}>()

const emit = defineEmits<{
  'update:value': [node: KratosNode, value: string]
  /** A button node was pressed. The caller runs its `onclick`. */
  'run': [node: KratosNode]
  /** A node UiKratosNode cannot render. */
  'unsupported': [node: KratosNode]
}>()

defineSlots<{
  prepend?: () => unknown
  /** One node; `update` writes a value back, since the node is fully controlled. */
  node?: (props: {
    errors: string[]
    hints: string[]
    kind: KratosNodeKind
    node: KratosNode
    submitting: boolean
    update: (next: string) => void
    value: string
  }) => unknown
  append?: () => unknown
}>()

const t = useTranslate()

// Kratos's text, unless the layer has a shorter one for that id (e.g. 4000006).
function textOf(message: KratosMessage): string {
  return kratosMessageText(message, t)
}

// Nameless nodes (an image, recovery codes) bind to nothing.
function valueOf(node: KratosNode): string {
  const name = node.attributes.name
  return name ? (values[name] ?? '') : ''
}

// Names repeat (two `method` submits), so the index breaks ties.
function nodeKey(node: KratosNode, index: number): string {
  return `${index}:${node.type}:${node.attributes.name ?? ''}:${String(node.attributes.value ?? '')}`
}

// The kind's glyph, as used elsewhere in the layer.
const noteIcons: Record<string, string> = {
  error: 'mdi-alert-circle-outline',
  success: 'mdi-check-circle-outline',
  info: 'mdi-information-outline',
}

function noteIcon(message: KratosMessage) {
  return noteIcons[kratosSeverity(message)] ?? noteIcons.info!
}
</script>
