// web/tests/updatecheck.spec.ts

import { defineComponent } from 'vue'
import { createPinia } from 'pinia'
import { PiniaColada } from '@pinia/colada'
import { flushPromises, mount } from '@vue/test-utils'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { useUpdateCheck } from '../src/composables/releases/useUpdateCheck'

afterEach(() => {
  vi.unstubAllGlobals()
})

describe('useUpdateCheck', () => {
  it('asks for no /version when the caller knows its build', async () => {
    const fetch = vi.fn(async () => ({ ok: true, status: 200, json: async () => ({ available: true, version: 'v2.0.0' }) }))
    vi.stubGlobal('fetch', fetch)
    let api!: ReturnType<typeof useUpdateCheck>
    mount(defineComponent({
      setup() {
        api = useUpdateCheck({ current: 'v1.0.0' })
        return () => null
      },
    }), { global: { plugins: [createPinia(), PiniaColada] } })
    await flushPromises()

    const paths = fetch.mock.calls.map(c => String((c as unknown[])[0]))
    expect(paths.some(p => p.includes('/version'))).toBe(false)
    expect(api.behind.value).toBe(true)
  })

  function setup(current: () => string | undefined) {
    const fetch = vi.fn(async (url: string) => ({
      ok: true, status: 200,
      json: async () => (String(url).includes('/version') ? { version: 'v1.0.0' } : { available: true, version: 'v2.0.0' }),
    }))
    vi.stubGlobal('fetch', fetch)
    let api!: ReturnType<typeof useUpdateCheck>
    mount(defineComponent({
      setup() {
        api = useUpdateCheck({ current })
        return () => null
      },
    }), { global: { plugins: [createPinia(), PiniaColada] } })
    const versionCalls = () => fetch.mock.calls.filter(c => String((c as unknown[])[0]).includes('/version')).length
    return { api: () => api, versionCalls }
  }

  // A shell that does not know its build yet answers undefined.
  it('falls back to /version while the given build is unknown', async () => {
    const { api, versionCalls } = setup(() => undefined)
    await flushPromises()
    expect(versionCalls()).toBe(1)
    expect(api().behind.value).toBe(true)
  })

  it('refreshes without /version when the build is given', async () => {
    const { api, versionCalls } = setup(() => 'v1.0.0')
    await flushPromises()
    await api().refresh()
    expect(versionCalls()).toBe(0)
  })
})
