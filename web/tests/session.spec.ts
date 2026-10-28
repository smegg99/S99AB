// web/tests/session.spec.ts

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { ref } from 'vue'
import { useSession, type SessionIdentity } from '../src/composables/kratos/useSession'
import { configureSession, loadSession } from '../src/composables/kratos/internal/session'

// The composable caches across calls, so each test starts from a clean module.
async function fresh() {
  vi.resetModules()
  return (await import('../src/composables/kratos/useSession')).useSession
}

const identity = {
  id: 'id-staff',
  traits: { email: 'biuro@kawapressco.pl', name: 'Biuro' },
  metadata_public: { role: 'staff' },
}

function answerWith(status: number, body?: unknown) {
  return vi.fn().mockResolvedValue({
    ok: status >= 200 && status < 300,
    status,
    json: async () => body,
  })
}

describe('useSession', () => {
  beforeEach(() => {
    vi.stubGlobal('window', {})
  })

  afterEach(() => {
    vi.unstubAllGlobals()
    vi.restoreAllMocks()
  })

  it('reads the identity out of a live session', async () => {
    vi.stubGlobal('fetch', answerWith(200, { identity }))
    const use = await fresh()

    const s = use()
    await vi.waitFor(() => expect(s.ready.value).toBe(true))

    expect(s.signedIn.value).toBe(true)
    expect(s.trait('email')).toBe('biuro@kawapressco.pl')
    expect(s.meta('role')).toBe('staff')
  })

  // Kratos answers 401 for a user who is not signed in; that is not an error.
  it('treats a 401 as signed out rather than as a failure', async () => {
    vi.stubGlobal('fetch', answerWith(401))
    const use = await fresh()

    const s = use()
    await vi.waitFor(() => expect(s.ready.value).toBe(true))

    expect(s.signedIn.value).toBe(false)
    expect(s.identity.value).toBeNull()
    expect(s.trait('email')).toBeUndefined()
  })

  // Concurrent callers in one paint share one request.
  it('shares one request between concurrent callers', async () => {
    const fetcher = answerWith(200, { identity })
    vi.stubGlobal('fetch', fetcher)
    const use = await fresh()

    const a = use()
    use()
    use()
    await vi.waitFor(() => expect(a.ready.value).toBe(true))

    expect(fetcher).toHaveBeenCalledTimes(1)
  })

  // A settings flow changes a trait, so the page can ask again.
  it('refreshes on demand', async () => {
    const fetcher = answerWith(200, { identity })
    vi.stubGlobal('fetch', fetcher)
    const use = await fresh()

    const s = use()
    await vi.waitFor(() => expect(s.ready.value).toBe(true))
    await s.refresh()

    expect(fetcher).toHaveBeenCalledTimes(2)
  })

  // Unknown is not signed out; a server render must not show a sign-in prompt to signed-in users.
  it('does not claim to be signed out before it has asked', () => {
    vi.unstubAllGlobals()
    // A whoami that never answers is the state before the first answer, without the network.
    vi.stubGlobal('fetch', vi.fn(() => new Promise(() => {})))
    const s = useSession()

    expect(s.ready.value).toBe(false)
    expect(s.signedIn.value).toBe(false)
  })
})

// The host seam: a server render supplies per-request state and a cookie-forwarding
// read, and identities must never leak between concurrent requests.
describe('useSession with a host', () => {
  // happy-dom supplies a window, so a server render removes it; unstubbing restores it.
  function noWindow() {
    vi.stubGlobal('window', undefined)
  }

  function makeStore() {
    return {
      identity: ref<SessionIdentity | null>(null),
      loaded: ref(false),
      pending: ref(false),
    }
  }

  afterEach(() => {
    configureSession(null)
    vi.unstubAllGlobals()
    vi.restoreAllMocks()
  })

  it('keeps its state in the host store rather than the module', async () => {
    noWindow()
    const store = makeStore()
    const read = vi.fn().mockResolvedValue(identity)
    configureSession({ store: () => store, read })

    await loadSession()

    expect(read).toHaveBeenCalledTimes(1)
    expect(store.loaded.value).toBe(true)
    expect(store.identity.value).toEqual(identity)
    expect(useSession().trait('email')).toBe('biuro@kawapressco.pl')
  })

  // The store is a function called at use time, since module-level refs are
  // shared across requests in one server process.
  it('never lets one request see another request identity', async () => {
    noWindow()

    const alice = makeStore()
    const bob = makeStore()
    let current = alice

    configureSession({
      store: () => current,
      read: async () => (current === alice
        ? { ...identity, id: 'alice' }
        : { ...identity, id: 'bob' }),
    })

    await loadSession()
    current = bob
    await loadSession()

    expect(alice.identity.value?.id).toBe('alice')
    expect(bob.identity.value?.id).toBe('bob')
  })

  // The payload already carries the answer, so the browser does not ask again.
  it('does not re-ask when the host store arrives already loaded', async () => {
    const fetcher = answerWith(200, { identity })
    vi.stubGlobal('window', {})
    vi.stubGlobal('fetch', fetcher)

    const store = makeStore()
    store.identity.value = identity
    store.loaded.value = true
    configureSession({ store: () => store })

    const s = useSession()

    expect(s.ready.value).toBe(true)
    expect(s.signedIn.value).toBe(true)
    expect(fetcher).not.toHaveBeenCalled()
  })

  // An unreachable Kratos does not mean signed out; it stays unloaded and the next call retries.
  it('stays unloaded when the host read throws', async () => {
    noWindow()
    const store = makeStore()
    configureSession({
      store: () => store,
      read: vi.fn().mockRejectedValue(new Error('kratos is down')),
    })

    await loadSession()

    expect(store.loaded.value).toBe(false)
    expect(store.identity.value).toBeNull()
    expect(store.pending.value).toBe(false)
  })

  // No window and no host read: nothing to ask with, so it stays unloaded.
  it('stays unloaded on a server with no host read', async () => {
    noWindow()
    const store = makeStore()
    configureSession({ store: () => store })

    await loadSession()

    expect(store.loaded.value).toBe(false)
  })
})
