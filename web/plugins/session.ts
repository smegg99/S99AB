// web/plugins/session.ts
//
// Resolves the session before the first paint: per-request state and the
// request cookie for the framework-free useSession.

import { config } from '../src/composables/kratos/internal/types'
import type { SessionIdentity } from '../src/composables/kratos/useSession'
import { configureSession, loadSession } from '../src/composables/kratos/internal/session'

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
        ? async () => {
          // No session cookie means signed out, without asking Kratos.
          const cookie = useRequestHeaders(['cookie']).cookie ?? ''
          if (!cookie.includes(`${config.sessionCookie}=`)) return null

          // Nuxt does not forward cookies cross-origin, so pass it by hand. An
          // expired session answers 401 and renders signed out instead of a 500.
          const res = await $fetch<{ identity: SessionIdentity }>(
            `${base}/sessions/whoami`,
            {
              headers: { accept: 'application/json', cookie },
              ignoreResponseError: true,
            },
          )
          return res?.identity ?? null
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
