// web/tests/repostat.spec.ts

import { createPinia } from 'pinia'
import { PiniaColada } from '@pinia/colada'
import { flushPromises, mount } from '@vue/test-utils'
import { afterEach, describe, expect, it, vi } from 'vitest'
import RepoStat from '../src/components/releases/RepoStat.vue'
import { vuetify } from './mount'

function stubApi(stars: number, forks = 3) {
  vi.stubGlobal('fetch', vi.fn(async () => ({
    ok: true, status: 200, json: async () => ({ available: true, stars, forks, html_url: 'https://example.test' }),
  })))
}

function mountStat(props: Record<string, unknown> = {}) {
  return mount(RepoStat, { props, global: { plugins: [createPinia(), PiniaColada, vuetify] } })
}

afterEach(() => {
  vi.unstubAllGlobals()
})

describe('UiRepoStat', () => {
  it('shows a compact count and keeps the exact one in its name', async () => {
    stubApi(1234)
    const wrapper = mountStat({ forks: false })
    await flushPromises()

    expect(wrapper.text()).toContain('1.2K')
    expect(wrapper.find('a').attributes('aria-label')).toBe('GitHub: 1234 stars')
    expect(wrapper.findAll('.repo__count')).toHaveLength(1)
  })

  it('stays hidden below the star threshold', async () => {
    stubApi(50)
    const wrapper = mountStat({ minStars: 51 })
    await flushPromises()

    expect(wrapper.find('a').exists()).toBe(false)
  })

  it('prints the raw number when compact is off', async () => {
    stubApi(1234)
    const wrapper = mountStat({ compact: false })
    await flushPromises()

    expect(wrapper.text()).toContain('1234')
  })
})
