// web/src/composables/kratos/internal/session.ts

import { ref } from 'vue'
import { config } from './types'
import type { SessionIdentity, SessionStore, SessionHost } from '../useSession'
import { kratosFetch } from './transport'

let host: SessionHost | null = null

/** Called by the layer's Nuxt plugin. Passing null restores the module state. */
export function configureSession(next: SessionHost | null) {
  host = next
}

// Fallback state without a host. Module-level refs are safe only in a browser.
export const identity = ref<SessionIdentity | null>(null)

export const loaded = ref(false)

export const pending = ref(false)

export function store(): SessionStore {
  return host ? host.store() : { identity, loaded, pending }
}

// Shares one request between concurrent browser callers. Browser only: on a
// server a module-scope promise would leak across requests.
let inFlight: Promise<void> | null = null

export const browser = () => typeof window !== 'undefined'

export async function whoami(): Promise<SessionIdentity | null> {
  const res = await kratosFetch(`${config.basePath}/sessions/whoami`)
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
