// web/plugins/session.ts
//
// Resolves the session before the first paint: per-request state and the
// request cookie for the framework-free useSession.

import { defineNuxtPlugin, useNuxtApp, useRequestHeaders, useRuntimeConfig, useState } from 'nuxt/app'
import { config } from '../src/composables/kratos/internal/types'
import type { SessionIdentity } from '../src/composables/kratos/useSession'
import { configureSession, loadSession, whoami } from '../src/composables/kratos/internal/session'

/**
 * Absolute Kratos address for server-side reads. The browser's proxy path
 * routes back into Nitro on the server and recurses until the heap runs out.
 */
function serverBase(): string {
  // `s99ab` is a private runtime key; a client read warns and returns undefined.
  if (import.meta.client) return ''
  const s99ab = useRuntimeConfig().s99ab as { kratosBase?: string } | undefined
  return s99ab?.kratosBase ?? ''
}

export default defineNuxtPlugin({
  name: 's99ab:session',

  // Must run after s99ab.ts, which configures kratos. Alphabetical order already
  // does it; dependsOn cannot, because s99ab.ts has no name.
  async setup() {
    const base = serverBase()

    configureSession({
      // useState is per request on the server and hydrates from the payload.
      store: () => ({
        identity: useState<SessionIdentity | null>('s99ab.session', () => null),
        loaded: useState<boolean>('s99ab.session.loaded', () => false),
        pending: useState<boolean>('s99ab.session.pending', () => false),
      }),

      // Without a server address the browser resolves the session.
      read: base
        ? async (signal) => {
          const incoming = useRequestHeaders(['cookie']).cookie ?? ''
          const cookie = incoming.split(';').map(value => value.trim()).filter((value) => {
            const name = value.slice(0, value.indexOf('='))
            return name === config.sessionCookie || name.startsWith('ory_session_')
          }).join('; ')
          return cookie ? whoami(signal, base, cookie) : null
        }
        : undefined,
    })

    if (import.meta.server) {
      await loadSession()
      return
    }

    // A prerendered payload carries a build-time "signed out" with loaded=true;
    // discard it and ask again in the browser.
    if (useNuxtApp().payload.prerenderedAt) await loadSession(true)
  },
})
