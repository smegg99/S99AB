// web/src/composables/kratos/useSession.ts

import { computed, type Ref } from 'vue'
import { store, loadSession } from './internal/session'

/** The parts of a Kratos session an app renders or authorizes on. */
export interface SessionIdentity {
  id: string
  traits: Record<string, unknown>
  /** Written only by the admin API, so safe to read a role from. */
  metadata_public?: Record<string, unknown>
}

export interface SessionStore {
  identity: Ref<SessionIdentity | null>
  loaded: Ref<boolean>
  pending: Ref<boolean>
}

/** Host hooks for resolving the session in a server render; see plugins/session.ts. */
export interface SessionHost {
  /** Per-request state, called at use time so requests never share refs. */
  store: () => SessionStore
  /** Server-side whoami with the request cookie forwarded; null is signed out. */
  read?: () => Promise<SessionIdentity | null>
}

/**
 * The signed-in identity. Until `ready`, render a skeleton; a sign-in prompt
 * would flash for signed-in users.
 */
export function useSession() {
  const state = store()
  void loadSession()

  return {
    identity: computed(() => state.identity.value),
    signedIn: computed(() => state.identity.value !== null),
    ready: computed(() => state.loaded.value),
    pending: computed(() => state.pending.value),

    trait: <T = string>(name: string): T | undefined =>
      state.identity.value?.traits?.[name] as T | undefined,

    /** A public-metadata field, typically a role. */
    meta: <T = string>(name: string): T | undefined =>
      state.identity.value?.metadata_public?.[name] as T | undefined,

    /** Re-reads the session, e.g. after a settings flow changed a trait. */
    refresh: () => loadSession(true),

    /** Forgets the cached session, for a sign-out that stays on the page. */
    forget: () => {
      state.identity.value = null
      state.loaded.value = false
    },
  }
}
