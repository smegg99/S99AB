<!-- web/src/components/state/SignInPrompt.vue -->
<template>
  <UiEmptyState
    :title="title ?? defaultTitle"
    :text="text"
    icon="mdi-login-variant"
  >
    <template
      v-if="$slots.prepend"
      #prepend
    >
      <slot name="prepend" />
    </template>

    <!-- Omitted when no path is configured, so no empty actions box keeps its
         margin. The slot replaces both buttons. -->
    <template
      v-if="hasActions"
      #actions
    >
      <!-- Both text buttons; the accent ink marks the first. -->
      <slot name="actions">
        <v-btn
          v-if="paths.signInPath"
          :to="signInTo"
          color="accent"
          variant="text"
        >
          {{ signInLabel }}
        </v-btn>
        <v-btn
          v-if="paths.signUpPath"
          :to="signUpTo"
          variant="text"
        >
          {{ signUpLabel }}
        </v-btn>
      </slot>
    </template>

    <template
      v-if="$slots.append"
      #append
    >
      <slot name="append" />
    </template>
  </UiEmptyState>
</template>

<script setup lang="ts">
import { computed, useSlots } from 'vue'
import UiEmptyState from './EmptyState.vue'
import { authRoute, resolveReturnTo } from '../../composables/kratos/internal/route'
import { useAuthPaths } from '../../composables/kratos/useAuthPaths'
import { useTranslate } from '../../composables/useTranslate'
import { inBrowser } from '../../browser/env'

// Shown to a signed-out user instead of an error.
const { returnTo = '' } = defineProps<{
  title?: string
  text?: string
  /** Where signing in returns to. Defaults to the current page. */
  returnTo?: string
}>()

const t = useTranslate()
const paths = useAuthPaths()
const slots = useSlots()

// resolveReturnTo drops auth routes and returns a path, which Kratos accepts
// without the origin being listed.
const origin = () =>
  (!inBrowser() ? '' : window.location.origin)

const back = computed(() =>
  resolveReturnTo(returnTo || authRoute()?.fullPath, origin()))

const hasActions = computed(() =>
  Boolean(slots.actions) || Boolean(paths.signInPath || paths.signUpPath))

// Both sign-in and registration carry the return path.
function to(path: string) {
  return back.value ? { path, query: { return_to: back.value } } : path
}

const signInTo = computed(() => to(paths.signInPath))
const signUpTo = computed(() => to(paths.signUpPath))

const defaultTitle = computed(() => t('auth.required', 'Sign in to continue'))
const signInLabel = computed(() => t('auth.signIn', 'Sign in'))
const signUpLabel = computed(() => t('auth.signUp', 'Create account'))
</script>
