<!-- web/src/components/auth/AccountMenu.vue -->
<template>
  <!-- Signed out: sign in, then sign up. -->
  <div
    v-if="!identity"
    class="s99ab-controls"
  >
    <v-btn
      variant="text"
      size="small"
      @click="signIn"
    >
      {{ signInLabel }}
    </v-btn>
    <v-btn
      v-if="canSignUp"
      variant="outlined"
      size="small"
      @click="signUp"
    >
      {{ signUpLabel }}
    </v-btn>
  </div>

  <v-btn
    v-else
    class="account"
    :aria-label="accountLabel"
    icon
    variant="text"
    size="small"
  >
    <v-avatar
      class="account__avatar"
      color="accent"
      size="26"
    >
      {{ initials }}
    </v-avatar>

    <v-menu activator="parent">
      <v-list density="compact">
        <!-- The signed-in identity, as the menu's first entry. -->
        <v-list-item
          :subtitle="secondary"
          :title="name"
        />

        <v-divider class="my-1" />

        <slot name="items" />

        <v-list-item
          :title="signOutLabel"
          prepend-icon="mdi-logout"
          @click="signOut"
        />
      </v-list>
    </v-menu>
  </v-btn>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import {
  useAccountIdentity,
  type AccountIdentity,
} from '../../composables/kratos/useAccountIdentity'
import { goToSignIn, goToSignUp } from '../../composables/kratos/internal/route'
import { useAuthPaths } from '../../composables/kratos/useAuthPaths'
import { useSignOut } from '../../composables/kratos/useSignOut'
import { useTranslate } from '../../composables/useTranslate'

// The account corner of an app bar: two buttons, or an avatar with a menu. The
// identity is a prop because the "who am I" endpoint is the app's.
const { identity = null, canRegister = true, routed = true } = defineProps<{
  /** null when signed out. */
  identity?: AccountIdentity | null
  /** Off hides sign-up. On also needs `s99ab.auth.signUpPath`. */
  canRegister?: boolean
  /** Off, it only emits: for a shell that opens the auth dialog or signs out itself. */
  routed?: boolean
}>()
const emit = defineEmits<{ signIn: [], signUp: [], signOut: [] }>()

defineSlots<{ items?: () => unknown }>()

const t = useTranslate()
const paths = useAuthPaths()
const endSession = useSignOut()

// A getter, because a destructured prop is a plain variable.
const { name, secondary, initials } = useAccountIdentity(() => identity)

// Vue casts an absent boolean prop to false, so it is never undefined here.
const canSignUp = computed(() => canRegister && Boolean(paths.signUpPath))

// Each handler emits first, telling the app whether the layer will also act.
function signIn() {
  emit('signIn')
  if (routed) goToSignIn()
}

function signUp() {
  emit('signUp')
  if (routed) goToSignUp()
}

function signOut() {
  emit('signOut')
  if (routed) void endSession()
}

const signInLabel = computed(() => t('auth.signIn', 'Sign in'))
const signUpLabel = computed(() => t('auth.signUp', 'Create account'))
const signOutLabel = computed(() => t('auth.signOut', 'Sign out'))
const accountLabel = computed(() => t('auth.account', 'Account'))
</script>

<style scoped>
/* Two capitals in a 26px circle, at the label scale. Ground and ink come from `color`. */
.account__avatar {
  font-size: var(--s99ab-label-size);
  font-weight: 700;
  letter-spacing: var(--s99ab-label-track);
}
</style>
