// web/tests/kratos-transport.spec.ts

import { afterEach, describe, expect, it, vi } from 'vitest'
import { kratosFetch, returnToQuery } from '../src/composables/kratos/internal/transport'

afterEach(() => vi.unstubAllGlobals())

describe('kratosFetch', () => {
  it('sends the cookie, asks for JSON and carries a deadline', async () => {
    const fetcher = vi.fn().mockResolvedValue(new Response('{}'))
    vi.stubGlobal('fetch', fetcher)

    await kratosFetch('/kratos/sessions/whoami')

    const [url, init] = fetcher.mock.calls[0]!
    expect(url).toBe('/kratos/sessions/whoami')
    expect(init.credentials).toBe('include')
    expect(init.headers.accept).toBe('application/json')
    expect(init.signal).toBeInstanceOf(AbortSignal)
  })

  it('keeps a caller signal and extra headers', async () => {
    const fetcher = vi.fn().mockResolvedValue(new Response('{}'))
    vi.stubGlobal('fetch', fetcher)
    const signal = new AbortController().signal

    await kratosFetch('/x', { method: 'POST', signal, headers: { 'content-type': 'text/plain' } })

    const init = fetcher.mock.calls[0]![1]
    expect(init.signal).toBe(signal)
    expect(init.method).toBe('POST')
    expect(init.headers).toEqual({ 'accept': 'application/json', 'content-type': 'text/plain' })
  })
})

describe('returnToQuery', () => {
  it('encodes a target and is empty without one', () => {
    expect(returnToQuery('https://a.test/x?y=1')).toBe('?return_to=https%3A%2F%2Fa.test%2Fx%3Fy%3D1')
    expect(returnToQuery('/x', '&')).toBe('&return_to=%2Fx')
    expect(returnToQuery('')).toBe('')
    expect(returnToQuery(undefined)).toBe('')
  })
})
