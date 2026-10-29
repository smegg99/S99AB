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

    <!-- A native form: Kratos picks the method from the submitter's name/value,
         which v-form's form.submit() re-post drops. Rendered only once a flow
         exists. novalidate because settings groups submit separately;
         validate() checks only the asked group. -->
    <form
      v-if="flow"
      :action="flow.ui.action"
      :method="flow.ui.method"
      class="s99ab-auth-form"
      novalidate
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

    <!-- No session on a flow that needs one: the sign-in prompt, returning here. -->
    <UiSignInPrompt
      v-else-if="signedOut"
      :return-to="here"
    />

    <!-- Already signed in: Kratos makes no flow, so say so and offer the way on. -->
    <div
      v-else-if="signedInAlready"
      class="s99ab-auth-signedin"
    >
      <p
        class="s99ab-auth-note s99ab-auth-note--info"
        role="status"
      >
        {{ alreadyText }}
      </p>
      <a
        v-if="onwardHref"
        class="s99ab-auth-signedin__go"
        :href="onwardHref"
      >{{ onwardText }}</a>
    </div>
  </UiAsync>
</template>

<script setup lang="ts">
import { computed, onMounted, ref, useSlots, watch } from 'vue'
import UiAsync from '../state/Async.vue'
import UiLoadingState from '../state/LoadingState.vue'
import UiKratosNodes from './KratosNodes.vue'
import UiSignInPrompt from '../state/SignInPrompt.vue'
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
import { useAuthPaths } from '../../composables/kratos/useAuthPaths'
import { useReturnTo } from '../../composables/kratos/useAuthRoute'
import { resolveReturnTo } from '../../composables/kratos/internal/route'
import { useTranslate } from '../../composables/useTranslate'
import { inBrowser } from '../../browser/env'

// A login or registration screen in one tag. Kratos decides the fields.
const { kind, autoStart = true, returnTo = '', seed } = defineProps<{
  /**
   * Which flow to render. Re-read on every request, so a change applies on the
   * next start()/restart().
   */
  kind: KratosFlowKind
  /** Where to send the browser after success, if Kratos allows it. */
  returnTo?: string
  /** Starts on mount unless the page already has. */
  autoStart?: boolean
  /**
   * Values for a fresh flow by field name. Applied after each load, only to
   * fields Kratos left empty.
   */
  seed?: Record<string, string>
}>()

const emit = defineEmits<{
  /** A button node was pressed, usually a WebAuthn ceremony. */
  'run': [node: KratosNode]
  /** Kratos sent a node this form cannot render. */
  'unsupported': [node: KratosNode]
  /** The flow, whenever Kratos returns a new one. */
  'update:flow': [flow: KratosFlow | null]
}>()

defineSlots<{
  prepend?: () => unknown
  append?: () => unknown
  /** One node, as UiKratosNodes passes it. */
  node?: InstanceType<typeof UiKratosNodes>['$slots']['node']
}>()

const t = useTranslate()
const slots = useSlots()
// The return URL from the query when the caller sets none. useReturnTo() drops
// off-origin targets.
const routeReturnTo = useReturnTo()
const target = computed(() => {
  // The prop is sanitised too: absolute URLs become paths (Kratos refuses
  // unlisted ones) and auth routes are dropped.
  const origin = !inBrowser() ? '' : window.location.origin
  return resolveReturnTo(returnTo, origin) || routeReturnTo.value
})

// Getters, so the flow follows prop changes.
const kratos = useKratosFlow(() => kind, {
  get returnTo() {
    return target.value
  },
})
const {
  flow, values, pending, failed, notice, submitting,
  messages, start, restart, submit,
} = kratos
const { renderable, errorsFor, hintsFor } = useKratosFields(kratos, t)

function setValue(node: KratosNode, next: string) {
  const name = node.attributes.name
  if (name) values[name] = next
}

// Seeds empty fields on every new flow, since `values` is re-seeded each step.
watch(flow, () => {
  if (!seed) return
  for (const [name, value] of Object.entries(seed)) {
    if (value && name in values && !values[name]) values[name] = value
  }
}, { immediate: true })

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

// Already signed in, nothing to render. Not an error, so no retry.
const signedInAlready = computed(() => notice.value === 'signedIn' && !flow.value)

// Signed out on a flow that needs a session (settings). No retry; sign in instead.
const signedOut = computed(() => notice.value === 'signedOut' && !flow.value)

// Returns here after signing in.
const here = computed(() => (!inBrowser()
  ? ''
  : window.location.pathname + window.location.search))

const alreadyText = computed(() => t('auth.alreadySignedIn', 'You are already signed in.'))
const onwardText = computed(() => t('auth.alreadySignedInGo', 'Go to your account'))

// The onward link: the flow's return URL, else the account screen, else home.
// Empty when none is configured, and then no link is drawn.
const paths = useAuthPaths()
const onwardHref = computed(() => returnTo || paths.settingsPath || paths.homePath || '')

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

  // Only the submitted group plus `default` (csrf and shared fields), so one
  // settings group is not blocked by another's empty required field.
  const asked = submitter.getAttribute('value') ?? ''
  const groups = new Set([asked, 'default'])

  // Checks the form's data, which is what the browser sends.
  const data = new FormData(form)
  const found: Record<string, string[]> = {}

  for (const node of renderable.value) {
    const name = node.attributes.name
    if (!name) continue
    if (!groups.has(node.group)) continue

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
