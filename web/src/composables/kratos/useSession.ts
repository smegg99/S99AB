// web/src/composables/kratos/useSession.ts

import { computed, ref, type Ref } from 'vue'
import { config } from './internal/types'

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

let host: SessionHost | null = null

/** Called by the layer's Nuxt plugin. Passing null restores the module state. */
export function configureSession(next: SessionHost | null) {
  host = next
}

// Fallback state without a host. Module-level refs are safe only in a browser.
const identity = ref<SessionIdentity | null>(null)
const loaded = ref(false)
const pending = ref(false)

function store(): SessionStore {
  return host ? host.store() : { identity, loaded, pending }
}

// Shares one request between concurrent browser callers. Browser only: on a
// server a module-scope promise would leak across requests.
let inFlight: Promise<void> | null = null

const browser = () => typeof window !== 'undefined'

async function whoami(): Promise<SessionIdentity | null> {
  const res = await fetch(`${config.basePath}/sessions/whoami`, {
    credentials: 'include',
    headers: { accept: 'application/json' },
  })
  // 401 means signed out.
  return res.ok
    ? ((await res.json()) as { identity: SessionIdentity }).identity
    : null
}

/** Resolves the session once; the host plugin awaits it before a server render. */
export async function loadSession(force = false): Promise<void> {
  const state = store()
  if (state.loaded.value && !force) return

  const read = browser() ? whoami : host?.read
  // No window and no host reader: stay unloaded, so `ready` means unknown.
  if (!read) return

  if (browser() && inFlight && !force) return inFlight

  const run = (async () => {
    state.pending.value = true
    try {
      state.identity.value = await read()
      state.loaded.value = true
    }
    catch {
      // Unreachable Kratos: render signed out, stay unloaded so the next call retries.
      state.identity.value = null
    }
    finally {
      state.pending.value = false
      if (browser()) inFlight = null
    }
  })()

  if (browser()) inFlight = run
  return run
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
