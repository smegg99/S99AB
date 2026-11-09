// web/src/composables/kratos/internal/session.ts

import { ref, shallowRef } from 'vue'
import { config } from './types'
import { kratosFetch, KRATOS_TIMEOUT_MS } from './transport'
import { inBrowser } from '../../../browser/env'
import type { SessionIdentity, SessionStore, SessionHost } from '../useSession'

let host: SessionHost | null = null

export function configureSession(next: SessionHost | null) {
  host = next
}

// Only browser callers use these refs; server callers supply request-local state.
export const identity = ref<SessionIdentity | null>(null)
export const loaded = ref(false)
export const pending = ref(false)

export function store(): SessionStore {
  return host ? host.store() : { identity, loaded, pending }
}

type Request = { controller: AbortController, promise?: Promise<void> }
const requests = new WeakMap<SessionStore['identity'], {
  current: Request | null
  error: ReturnType<typeof shallowRef<unknown>>
}>()

export function sessionRequest(state: SessionStore) {
  let value = requests.get(state.identity)
  if (!value) {
    value = { current: null, error: shallowRef(null) }
    requests.set(state.identity, value)
  }
  return value
}

function record(value: unknown): value is Record<string, unknown> {
  return !!value && typeof value === 'object' && !Array.isArray(value)
}

async function sessionBody(response: Response): Promise<unknown> {
  if (!response.body) throw new Error('kratos: empty session response')
  const reader = response.body.getReader()
  const decoder = new TextDecoder()
  let size = 0
  let text = ''
  try {
    for (;;) {
      const { done, value } = await reader.read()
      if (done) break
      size += value.byteLength
      if (size > 1024 * 1024) {
        await reader.cancel()
        throw new Error('kratos: session response too large')
      }
      text += decoder.decode(value, { stream: true })
    }
    return JSON.parse(text + decoder.decode())
  }
  finally {
    reader.releaseLock()
  }
}

export async function whoami(signal?: AbortSignal, base = config.basePath, cookie?: string): Promise<SessionIdentity | null> {
  const res = await kratosFetch(`${base}/sessions/whoami`, {
    signal, redirect: 'error', headers: cookie ? { cookie } : undefined,
  })
  if (res.status === 401) return null
  if (!res.ok) throw new Error(`kratos: whoami returned ${res.status}`)
  const body = await sessionBody(res)
  if (!record(body) || typeof body.active !== 'boolean') throw new Error('kratos: invalid session')
  if (!body.active) return null
  const value = body.identity
  if (typeof body.id !== 'string' || !body.id || !record(value)
    || typeof value.id !== 'string' || !value.id || !record(value.traits)
    || (value.metadata_public != null && !record(value.metadata_public))) {
    throw new Error('kratos: incomplete session')
  }
  return { id: value.id, traits: value.traits, metadata_public: value.metadata_public ?? undefined } as SessionIdentity
}

export function forgetSession(state: SessionStore) {
  const request = sessionRequest(state)
  const old = request.current
  request.current = null
  old?.controller.abort()
  request.error.value = null
  state.identity.value = null
  state.loaded.value = false
  state.pending.value = false
}

/** Resolves once; only the latest request may update this store. */
export function loadSession(force = false, state = store()): Promise<void> {
  if (state.loaded.value && !force) return Promise.resolve()
  const read = inBrowser() ? whoami : host?.read
  if (!read) return Promise.resolve()
  const shared = sessionRequest(state)
  if (shared.current && !force) return shared.current.promise ?? Promise.resolve()
  shared.current?.controller.abort()
  const request: Request = { controller: new AbortController() }
  shared.current = request
  shared.error.value = null
  state.pending.value = true
  const signal = request.controller.signal
  const timer = setTimeout(() => request.controller.abort(new Error('kratos: session timed out')), KRATOS_TIMEOUT_MS)
  let abort: () => void = () => {}
  const aborted = new Promise<never>((_, reject) => {
    abort = () => reject(signal.reason)
    signal.addEventListener('abort', abort, { once: true })
  })
  request.promise = (async () => {
    try {
      const value = await Promise.race([read(signal), aborted])
      if (shared.current !== request) return
      state.identity.value = value
      state.loaded.value = true
    }
    catch (error) {
      if (shared.current !== request) return
      state.identity.value = null
      state.loaded.value = false
      shared.error.value = error
    }
    finally {
      clearTimeout(timer)
      signal.removeEventListener('abort', abort)
      if (shared.current === request) {
        state.pending.value = false
        shared.current = null
      }
    }
  })()
  return request.promise
}
