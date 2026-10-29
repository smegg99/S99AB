<!-- web/src/components/auth/KratosInspector.vue -->
<template>
  <div
    v-if="flow"
    class="s99ab-kx"
  >
    <!-- Flow metadata first: expiry explains a form that will not submit, and
         the id is what Kratos logs are searched by. -->
    <dl class="s99ab-kx__head">
      <div>
        <dt>{{ flowLabel }}</dt>
        <dd>{{ kind }}</dd>
      </div>
      <div>
        <dt>{{ idLabel }}</dt>
        <dd class="num">
          {{ shortId }}
        </dd>
      </div>
      <div v-if="expires">
        <dt>{{ expiresLabel }}</dt>
        <dd class="num">
          {{ expires }}
        </dd>
      </div>
      <div>
        <dt>{{ methodLabel }}</dt>
        <dd>{{ flow.ui.method }}</dd>
      </div>
    </dl>

    <!-- Flow-level messages with their Kratos ids, which the docs are indexed by. -->
    <ul
      v-if="flow.ui.messages?.length"
      class="s99ab-kx__messages"
    >
      <li
        v-for="message in flow.ui.messages"
        :key="message.id"
        :class="`s99ab-kx__msg--${kratosSeverity(message)}`"
        class="s99ab-kx__msg"
      >
        <span class="num">{{ message.id }}</span>
        {{ message.text }}
      </li>
    </ul>

    <!-- Grouped by method (password, code, oidc, ...). -->
    <section
      v-for="group in groups"
      :key="group.name"
      class="s99ab-kx__group"
    >
      <span class="s99ab-eyebrow">{{ group.name }}</span>

      <div
        v-for="row in group.rows"
        :key="row.key"
        :class="{ 's99ab-kx__row--dropped': row.dropped }"
        class="s99ab-kx__row"
      >
        <span class="s99ab-kx__name">{{ row.name }}</span>
        <span class="s99ab-kx__type num">{{ row.type }}</span>

        <span
          v-for="mark in row.marks"
          :key="mark"
          class="s99ab-kx__mark"
        >{{ mark }}</span>

        <!-- Flags a node the renderer cannot draw. -->
        <span
          v-if="row.dropped"
          class="s99ab-kx__dropped"
        >{{ unsupportedLabel }}</span>
      </div>
    </section>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import {
  kratosGroup,
  kratosNodeKind,
  kratosSeverity,
} from '../../composables/kratos/internal/nodes'
import type { KratosFlow } from '../../composables/kratos/internal/types'
import { useTranslate } from '../../composables/useTranslate'

/**
 * The flow Kratos returned, one row per node, for debugging a missing control.
 * Values are left out: a flow carries the CSRF token and typed input.
 */
const { flow, kind = '' } = defineProps<{
  flow: KratosFlow | null
  /** Which flow this is; Kratos does not put it in the body. */
  kind?: string
}>()

const t = useTranslate()
const flowLabel = computed(() => t('inspect.flow', 'flow'))
const idLabel = computed(() => t('inspect.id', 'id'))
const expiresLabel = computed(() => t('inspect.expires', 'expires'))
const methodLabel = computed(() => t('inspect.method', 'method'))
const unsupportedLabel = computed(() => t('inspect.unsupported', 'not rendered'))

// Long enough to match a log line without wrapping.
const shortId = computed(() => (flow?.id ?? '').slice(0, 8))

const expires = computed(() => {
  const raw = (flow as { expires_at?: string } | null)?.expires_at
  if (!raw) return ''

  const ms = new Date(raw).getTime() - Date.now()
  if (!Number.isFinite(ms)) return ''
  // Minutes, rounded down, so under a minute shows "0m".
  return ms > 0 ? `${Math.floor(ms / 60000)}m` : t('inspect.expired', 'expired')
})

/** The node attributes worth showing, as short marks. */
function marksFor(node: KratosFlow['ui']['nodes'][number]): string[] {
  const a = node.attributes
  const out: string[] = []
  if (a.required) out.push('required')
  if (a.disabled) out.push('disabled')
  if (a.autocomplete) out.push(a.autocomplete)
  if (node.messages?.length) out.push(`${node.messages.length} msg`)
  return out
}

const groups = computed(() => {
  const byName = new Map<string, { name: string, rows: Row[] }>()

  for (const [i, node] of (flow?.ui.nodes ?? []).entries()) {
    const name = kratosGroup(node)
    let group = byName.get(name)
    if (!group) {
      group = { name, rows: [] }
      byName.set(name, group)
    }

    const nodeKind = kratosNodeKind(node)
    group.rows.push({
      key: `${i}:${node.attributes.name ?? ''}`,
      name: node.attributes.name || node.type,
      type: `${node.type}/${node.attributes.type ?? nodeKind}`,
      marks: marksFor(node),
      // `script` is understood but declined; both it and unknown leave the user
      // without the control, so both are flagged.
      dropped: nodeKind === 'unknown' || nodeKind === 'script',
    })
  }
  return [...byName.values()]
})

interface Row {
  key: string
  name: string
  type: string
  marks: string[]
  dropped: boolean
}
</script>
