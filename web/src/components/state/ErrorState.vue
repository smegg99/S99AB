<!-- web/src/components/state/ErrorState.vue -->
<template>
  <!-- A 401 shows a sign-in prompt instead of an error. Needs
       s99ab.auth.signInPath. -->
  <UiSignInPrompt
    v-if="needsSignIn"
    :return-to="returnTo()"
  />

  <!-- Keyed on the attempt; see useErrorAttempt. -->
  <UiMotion
    v-else
    name="swap"
  >
    <!-- The toast's shell in the error colour, so inline and toasted failures match. -->
    <div
      :key="attempt"
      class="s99ab-state s99ab-state--error"
      role="alert"
    >
      <v-icon
        icon="mdi-alert-circle-outline"
        class="s99ab-state__icon"
      />

      <div class="s99ab-state__body">
        <!-- A heading, since an error block is often a page's whole content. -->
        <span
          class="s99ab-state__title"
          role="heading"
          aria-level="2"
        >{{ headline }}</span>

        <!-- Only when the caller supplied its own headline. -->
        <p
          v-if="title"
          class="s99ab-state__text"
        >
          {{ resolved.text }}
        </p>

        <ul
          v-if="detailList.length"
          class="s99ab-state__details"
        >
          <li
            v-for="d in detailList"
            :key="d.field"
          >
            {{ d.field }}: <code>{{ d.code }}</code>
          </li>
        </ul>
      </div>

      <div
        v-if="retryable"
        class="s99ab-state__act s99ab-controls s99ab-controls--dense"
      >
        <!-- Never disabled: the spinning icon shows the attempt, and a second
             press is another attempt. -->
        <v-btn
          variant="text"
          size="small"
          @click="emit('retry')"
        >
          <!-- The icon spins; no second indicator. -->
          <v-icon
            :class="{ 's99ab-spin': retrying }"
            icon="mdi-refresh"
            start
          />
          {{ retryLabel }}
        </v-btn>
      </div>
    </div>
  </UiMotion>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import UiMotion from '../motion/Motion.vue'
import UiSignInPrompt from './SignInPrompt.vue'
import { useApiError } from '../../composables/state/useApiError'
import { useAuthPaths } from '../../composables/kratos/useAuthPaths'
import { resolveReturnTo } from '../../composables/kratos/internal/route'
import { useErrorAttempt } from '../../composables/state/useErrorAttempt'
import { useTranslate } from '../../composables/useTranslate'

// Shows a translated message, never the raw error (URLs, stacks, proxy HTML).
const { error, title, retryable = true, retrying = false } = defineProps<{
  error: unknown
  title?: string
  retryable?: boolean
  /** A retry is in flight. Set by the caller, since `@retry` cannot be awaited. */
  retrying?: boolean
}>()

const emit = defineEmits<{ retry: [] }>()

const t = useTranslate()
const describe = useApiError()
const paths = useAuthPaths()
const { attempt } = useErrorAttempt(() => error, () => retrying)

const resolved = computed(() => describe(error))

const needsSignIn = computed(() =>
  resolved.value.code === 'unauthorized' && Boolean(paths.signInPath),
)

const headline = computed(() => title ?? resolved.value.text)

// Field codes say which input to fix.
const detailList = computed(() =>
  Object.entries(resolved.value.details ?? {}).map(([field, code]) => ({ field, code })),
)

const retryLabel = computed(() => t('common.retry', 'Retry'))

// Read from location at call time: works without a router, and a computed would
// cache the first path since location is not reactive.
function returnTo() {
  if (typeof window === 'undefined') return ''
  return resolveReturnTo(
    window.location.pathname + window.location.search,
    window.location.origin,
  )
}
</script>
