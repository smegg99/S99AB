<!-- web/src/components/auth/AuthCard.vue -->
<template>
  <UiStack
    gap="tight"
    class="s99ab-auth__card"
  >
    <!-- Built on UiPanel, so the sign-in screen matches the rest of the app. -->
    <UiPanel
      :title="appName || heading"
      :icon="icon"
      :subtitle="subtitle"
    >
      <!-- The flow's name on the right of the head, dropped when there is no app
         name so the strip does not say "Sign in" twice. The mark is in UiAuthPage. -->
      <template
        v-if="appName"
        #meta
      >
        {{ heading }}
      </template>

      <slot name="prepend" />

      <UiKratosForm
        :kind="kind"
        :return-to="returnTo"
        @run="emit('run', $event)"
        @unsupported="emit('unsupported', $event)"
      >
        <template
          v-if="slots['form-prepend']"
          #prepend
        >
          <slot name="form-prepend" />
        </template>

        <template
          v-if="slots['form-append']"
          #append
        >
          <slot name="form-append" />
        </template>
      </UiKratosForm>

      <slot name="append" />

      <!-- The build, in the foot strip. -->
      <template
        v-if="hasFoot"
        #footer
      >
        <dl
          v-if="hasPlate"
          class="s99ab-auth__plate"
        >
          <slot name="plate">
            <div v-if="build.version">
              <dt>{{ versionLabel }}</dt>
              <dd>{{ build.version }}</dd>
            </div>
            <div v-if="build.commit">
              <dt>{{ commitLabel }}</dt>
              <dd>{{ build.commit }}</dd>
            </div>
            <div v-if="build.builtAt">
              <dt>{{ builtLabel }}</dt>
              <dd>{{ build.builtAt }}</dd>
            </div>
          </slot>
        </dl>

        <span class="panel__sp" />

        <!-- The repository readout, past the plate's run. Wrapped so the
             stylesheet can hide the strip when UiRepoStat renders nothing. -->
        <span class="s99ab-auth__end">
          <slot name="plate-end">
            <UiRepoStat
              v-if="repo"
              :show-forks="false"
            />
          </slot>
        </span>
      </template>
    </UiPanel>

    <!-- Outside the panel, so it does not read as part of the form. -->
    <div
      v-if="canSwitch"
      class="s99ab-auth__switch"
    >
      <span>{{ switchLead }}</span>
      <v-btn
        :to="switchTo"
        density="compact"
        size="small"
        variant="text"
        @click="emit('switch', other)"
      >
        {{ switchLabel }}
      </v-btn>
    </div>

    <slot name="footer" />
  </UiStack>
</template>

<script setup lang="ts">
import { computed, useSlots } from 'vue'
import UiKratosForm from './KratosForm.vue'
import UiPanel from '../primitives/Panel.vue'
import UiRepoStat from '../releases/RepoStat.vue'
import UiStack from '../primitives/Stack.vue'
import { useAuthPaths } from '../../composables/kratos/useAuthPaths'
import { useTranslate } from '../../composables/useTranslate'
import type { KratosFlowKind, KratosNode } from '../../composables/kratos/useKratosFlow'

/**
 * One credential card: app and flow names in the head, Kratos fields in the
 * body, the build in the foot. Shared by the page, the dialog and inline use.
 */
const {
  kind = 'login',
  returnTo = '',
  appName = '',
  icon = '',
  title,
  subtitle,
  version = '',
  commit = '',
  builtAt = '',
  routed = true,
  repo,
} = defineProps<{
  kind?: KratosFlowKind
  returnTo?: string
  /** The app's name, for the head strip. */
  appName?: string
  icon?: string
  /** Overrides the flow's name. Unset, it follows the kind. */
  title?: string
  subtitle?: string
  /** Empty in a dev build. */
  version?: string
  commit?: string
  builtAt?: string
  /**
   * Draws the repository readout. Off by default because UiRepoStat runs a
   * Colada query, which needs Pinia.
   */
  repo?: boolean
  /** The switch navigates. Off inside a dialog, where it emits instead. */
  routed?: boolean
}>()

const emit = defineEmits<{
  switch: [kind: KratosFlowKind]
  run: [node: KratosNode]
  unsupported: [node: KratosNode]
}>()

const t = useTranslate()
const versionLabel = computed(() => t('auth.version', 'version'))
const commitLabel = computed(() => t('auth.commit', 'commit'))
const builtLabel = computed(() => t('auth.built', 'built'))
const paths = useAuthPaths()
const slots = useSlots()

const isLogin = computed(() => kind !== 'registration')
const other = computed<KratosFlowKind>(() => (isLogin.value ? 'registration' : 'login'))

const heading = computed(() =>
  title ?? (isLogin.value ? t('auth.signIn', 'Sign in') : t('auth.signUp', 'Create account')))

// Build info comes in as props: fetching /version here would require Pinia even
// when disabled. Apps call useBuildVersion() and pass the result.
const build = computed(() => ({ version, commit, builtAt }))

const hasPlate = computed(() =>
  Boolean(slots.plate) || Boolean(version || commit || builtAt))

// The strip is drawn for either half, so a repo readout shows without build info.
const hasFoot = computed(() => hasPlate.value || Boolean(slots['plate-end']) || repo)

const switchLead = computed(() =>
  isLogin.value
    ? t('auth.noAccount', 'No account yet?')
    : t('auth.haveAccount', 'Already have one?'))

const switchLabel = computed(() =>
  isLogin.value ? t('auth.signUp', 'Create account') : t('auth.signIn', 'Sign in'))

// Only where the app has a route for it, such as a sign-up path.
const switchTo = computed(() => {
  if (!routed) return undefined
  return isLogin.value ? paths.signUpPath : paths.signInPath
})

const canSwitch = computed(() => Boolean(switchTo.value) || !routed)
</script>
