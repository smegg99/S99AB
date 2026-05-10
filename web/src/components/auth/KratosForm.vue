<!-- web/src/components/auth/KratosForm.vue -->
<template>
  <!-- UiAsync gives the box height animation and a delayed skeleton. The flow
       is adapted to its three-ref query shape; it is not a Colada query. -->
  <UiAsync
    :query="asAsync"
    loading="inline"
    flush
    @retry="restart()"
  >
    <template #loading>
      <UiLoadingState
        inline
        :text="startingLabel"
      />
    </template>

    <!-- A native form, deliberately.
       The button that was clicked is what tells Kratos which method to run -
       `method=password`, `method=profile`, or `screen` to go back - and the
       only thing that puts it in the body is the browser, from the submitter
       on this event. Vuetify's v-form cannot carry that: it cancels the
       submit and re-posts through form.submit(), which sends no submitter at
       all, so the pair is dropped and Kratos answers "Could not find a
       strategy to sign you up with. Did you fill out the form correctly?" -
       with nothing wrong with the form.
       action and method stay on the element even though the submit is
       intercepted: they are what the form would do unaided, and they keep the
       target in one place rather than only inside the handler. -->
    <!-- Only once there is a flow to render.

         UiAsync holds its loading state back for a moment so a fast answer
         never flashes a skeleton, and during that window the content slot is
         what renders - with no flow behind it, that is an empty form. Nothing
         is the right thing to draw there; the box animates open when the
         fields arrive. -->
    <form
      v-if="flow"
      :action="flow.ui.action"
      :method="flow.ui.method"
      class="s99ab-auth-form"
      @submit.prevent="onSubmit"
    >
      <!-- Not keyed or wrapped in UiMotion: nested Transitions inside UiAsync
           never finish leaving. UiAutoHeight still animates the height. -->
      <UiKratosNodes
        :nodes="renderable"
        :messages="shownMessages"
        :values="values"
        :errors-for="errorsWith"
        :hints-for="hintsFor"
        :submitting="submitting"
        @update:value="setValue"
        @run="emit('run', $event)"
        @unsupported="emit('unsupported', $event)"
      >
        <template
          v-if="slots.prepend"
          #prepend
        >
          <slot name="prepend" />
        </template>

        <template
          v-if="slots.append"
          #append
        >
          <slot name="append" />
        </template>

        <template
          v-if="slots.node"
          #node="scope"
        >
          <slot
            name="node"
            v-bind="scope"
          />
        </template>
      </UiKratosNodes>
    </form>
  </UiAsync>
</template>

<script setup lang="ts">
import { computed, onMounted, ref, useSlots, watch } from 'vue'
import UiAsync from '../state/Async.vue'
import UiLoadingState from '../state/LoadingState.vue'
import UiKratosNodes from './KratosNodes.vue'
import { kratosRules } from '../../composables/kratos/internal/rules'
import { config as kratosConfig } from '../../composables/kratos/internal/types'
import { useKratosFields } from '../../composables/kratos/useKratosFields'
import {
  useKratosFlow,
  type KratosFlow,
  type KratosFlowKind,
  type KratosMessage,
  type KratosNode,
} from '../../composables/kratos/useKratosFlow'
import { useTranslate } from '../../composables/useTranslate'

// A whole login or registration screen in one tag. The page supplies the kind
// and the frame around it; which fields exist is Kratos's to decide.
const { kind, autoStart = true, returnTo = '' } = defineProps<{
  /**
   * Which flow to render. The flow is created from it on mount and it is
   * re-read on every request, so changing it takes effect on the next
   * start()/restart() rather than needing a fresh component.
   */
  kind: KratosFlowKind
  /** Where to send the browser after the flow succeeds, if Kratos allows it. */
  returnTo?: string
  /** Starts on mount unless the page has already done it. */
  autoStart?: boolean
}>()

const emit = defineEmits<{
  /** A button node was pressed, usually a WebAuthn ceremony. */
  'run': [node: KratosNode]
  /** Kratos sent a node this form cannot render. */
  'unsupported': [node: KratosNode]
  /** The flow, whenever Kratos returns a new one. */
  'update:flow': [flow: KratosFlow | null]
}>()

const t = useTranslate()
const slots = useSlots()
// Both arrive as getters: they are destructured props, so passing either by
// value would pin the flow to whatever the parent happened to say first.
// Getters, so the flow follows prop changes.
const kratos = useKratosFlow(() => kind, {
  get returnTo() {
    return returnTo
  },
})
const {
  flow, values, pending, failed, notice, submitting,
  messages, start, restart, submit,
} = kratos
const { renderable, errorsFor, hintsFor } = useKratosFields(kratos)

function setValue(node: KratosNode, next: string) {
  const name = node.attributes.name
  if (name) values[name] = next
}

// Separate constants so ErrorState's memoised identity changes only with the
// failure. An expired flow and an unreachable server say different things.
const flowExpired = { code: 'validation', message: 'auth.flowExpired' }
const flowUnreachable = { code: 'network', message: 'auth.flowUnreachable' }

const failure = computed(() =>
  (notice.value === 'expired' ? flowExpired : flowUnreachable),
)

// The flow as UiAsync's three refs. `?? undefined` because useFirstLoad tests
// for undefined and the flow rests at null.
const asAsync = {
  data: computed(() => flow.value ?? undefined),
  error: computed(() => (failed.value ? failure.value : null)),
  asyncStatus: computed(() => (pending.value ? 'loading' : 'idle')),
}

const startingLabel = computed(() => t('auth.starting', 'Starting...'))

// Explains a replaced expired flow at the top of the new form, since its fields are now empty.
const shownMessages = computed<KratosMessage[]>(() => {
  if (notice.value !== 'expired' || !flow.value) return messages.value
  return [
    { id: 0, text: t('auth.flowExpired', 'This form has expired. Start again.'), type: 'error' },
    ...messages.value,
  ]
})

// Emitted, so callers can see the flow without reaching into the component.
watch(flow, next => emit('update:flow', next), { immediate: true })

// A changed kind restarts in place; the old fields stay until the new flow lands.
watch(() => kind, () => {
  void restart()
})

onMounted(() => {
  if (autoStart) void start()
})

// Client-side validation before the request, since a native form has no v-form
// to run the field rules. Kratos still validates.
const clientErrors = ref<Record<string, string[]>>({})

function validate(form: HTMLFormElement, submitter: Element | null): boolean {
  // Only the `method` button; a `screen` back button must not be blocked.
  if (!(submitter instanceof HTMLElement) || submitter.getAttribute('name') !== 'method') {
    clientErrors.value = {}
    return true
  }

  // Checks the form's data, which is what the browser sends.
  const data = new FormData(form)
  const found: Record<string, string[]> = {}

  for (const node of renderable.value) {
    const name = node.attributes.name
    if (!name) continue

    const value = String(data.get(name) ?? '')
    const failed = kratosRules(node, t, kratosConfig.identifierIsEmail)
      .map(rule => rule(value))
      .filter((result): result is string => result !== true)

    if (failed.length) found[name] = failed
  }

  clientErrors.value = found
  return Object.keys(found).length === 0
}

// Client errors first: they describe what is on screen now.
function errorsWith(name: string): string[] {
  return [...(clientErrors.value[name] ?? []), ...errorsFor(name)]
}

// A new flow clears errors from the last one.
watch(flow, () => {
  clientErrors.value = {}
})

// Kratos reads the method from the submitter's name/value pair.
function onSubmit(event: Event) {
  const form = event.currentTarget as HTMLFormElement
  const submitter = (event as SubmitEvent).submitter
  if (!validate(form, submitter)) return
  void submit(form, submitter)
}

defineExpose({ start, restart })
</script>
