// web/tests/session-races.spec.ts

import { afterEach, beforeEach, expect, it, vi } from 'vitest'

const identity = { id: 'account', traits: {} }
const response = (id = identity.id) => new Response(JSON.stringify({ id: 'session', active: true, identity: { ...identity, id } }))
const deferred = () => {
  let resolve!: (value: Response) => void
  const promise = new Promise<Response>((done) => {
    resolve = done
  })
  return { promise, resolve }
}
beforeEach(() => {
  vi.resetModules()
})
afterEach(() => {
  vi.unstubAllGlobals()
  vi.useRealTimers()
})

it('bounds a session read even when its transport ignores cancellation', async () => {
  vi.useFakeTimers()
  vi.stubGlobal('fetch', vi.fn(() => new Promise(() => {})))
  const { useSession } = await import('../src/composables/kratos/useSession')
  const { loadSession } = await import('../src/composables/kratos/internal/session')
  const session = useSession()
  const read = loadSession()
  await vi.advanceTimersByTimeAsync(15001)
  await read
  expect(session.ready.value).toBe(false)
  expect(session.pending.value).toBe(false)
  expect(session.error.value).toBeInstanceOf(Error)
})

it('keeps an outage retryable and exposes the failure', async () => {
  const fetcher = vi.fn().mockResolvedValueOnce(new Response('{}', { status: 503 })).mockResolvedValueOnce(response())
  vi.stubGlobal('fetch', fetcher)
  const { useSession } = await import('../src/composables/kratos/useSession')
  const { loadSession } = await import('../src/composables/kratos/internal/session')
  const session = useSession()
  await loadSession()
  expect(session.ready.value).toBe(false)
  expect(session.error.value).toBeInstanceOf(Error)
  await loadSession()
  expect(session.identity.value?.id).toBe(identity.id)
  expect(session.error.value).toBeNull()
  expect(fetcher).toHaveBeenCalledTimes(2)
})

it('does not restore a forgotten identity from an old request', async () => {
  const old = deferred()
  vi.stubGlobal('fetch', vi.fn(() => old.promise))
  const { useSession } = await import('../src/composables/kratos/useSession')
  const { loadSession } = await import('../src/composables/kratos/internal/session')
  const session = useSession()
  const pending = loadSession()
  session.forget()
  old.resolve(response())
  await pending
  expect(session.identity.value).toBeNull()
  expect(session.ready.value).toBe(false)
  expect(session.pending.value).toBe(false)
})

it('only lets the newest refresh write identity and pending state', async () => {
  const old = deferred()
  const fresh = deferred()
  vi.stubGlobal('fetch', vi.fn().mockReturnValueOnce(old.promise).mockReturnValueOnce(fresh.promise))
  const { useSession } = await import('../src/composables/kratos/useSession')
  const { loadSession } = await import('../src/composables/kratos/internal/session')
  const session = useSession()
  const first = loadSession()
  const second = session.refresh()
  old.resolve(response('old'))
  await first
  expect(session.pending.value).toBe(true)
  fresh.resolve(response('new'))
  await second
  expect(session.identity.value?.id).toBe('new')
  expect(session.pending.value).toBe(false)
})

it.each([{}, { active: true }, { id: 's', active: true, identity: { id: 'i', traits: [] } }])('rejects a malformed session %j', async (body) => {
  vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response(JSON.stringify(body))))
  const { whoami } = await import('../src/composables/kratos/internal/session')
  await expect(whoami()).rejects.toThrow('kratos:')
})

it('rejects an oversized session body', async () => {
  vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response(' '.repeat(1024 * 1024 + 1))))
  const { whoami } = await import('../src/composables/kratos/internal/session')
  await expect(whoami()).rejects.toThrow('response too large')
})
