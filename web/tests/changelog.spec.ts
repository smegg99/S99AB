// web/tests/changelog.spec.ts

import { h } from 'vue'
import { createPinia } from 'pinia'
import { PiniaColada } from '@pinia/colada'
import { flushPromises, mount } from '@vue/test-utils'
import { afterEach, describe, expect, it, vi } from 'vitest'
import Changelog from '../src/components/releases/Changelog.vue'
import EmptyState from '../src/components/state/EmptyState.vue'
import { configureReleases, resetReleasesConfig } from '../src/composables/releases/internal/api'
import { vuetify } from './mount'

function release(version: string) {
  return {
    available: true, version, name: version, published_at: '2026-07-01T12:00:00Z',
    html_url: `https://example.test/${version}`, assets: [], source: [], notes: 'Fixed.', notes_locale: 'en',
  }
}

function stubApi(releases: unknown[]) {
  vi.stubGlobal('fetch', vi.fn(async () => ({ ok: true, status: 200, json: async () => ({ releases }) })))
}

function mountChangelog(props: Record<string, unknown> = {}, slots: Record<string, (scope: never) => unknown> = {}) {
  return mount(Changelog, { props, slots: slots as never, global: { plugins: [createPinia(), PiniaColada, vuetify] } })
}

afterEach(() => {
  vi.unstubAllGlobals()
  resetReleasesConfig()
})

describe('UiChangelog', () => {
  it('titles each release at the heading level the page needs', async () => {
    stubApi([release('v2.0.0'), release('v1.0.0')])
    const wrapper = mountChangelog({ headingLevel: 3 })
    await flushPromises()

    expect(wrapper.findAll('h3').map(h => h.text())).toEqual(['v2.0.0', 'v1.0.0'])
    expect(wrapper.find('h2').exists()).toBe(false)
  })

  it('writes the date in long form', async () => {
    stubApi([release('v2.0.0')])
    const wrapper = mountChangelog()
    await flushPromises()

    expect(wrapper.find('time').text()).toBe('July 1, 2026')
  })

  it('puts the page\'s own content above the list and under each entry', async () => {
    stubApi([release('v2.0.0')])
    const wrapper = mountChangelog({}, {
      'head': () => h('p', { class: 'intro' }, 'Intro'),
      'entry-foot': ({ release: r }: { release: { version: string } }) => h('p', { class: 'foot' }, `after ${r.version}`),
    })
    await flushPromises()

    expect(wrapper.find('.intro').exists()).toBe(true)
    expect(wrapper.find('.foot').text()).toBe('after v2.0.0')
  })

  it('offers the releases page when nothing is published', async () => {
    configureReleases({ releasesUrl: 'https://example.test/releases' })
    stubApi([])
    const wrapper = mountChangelog()
    await flushPromises()

    expect(wrapper.findComponent(EmptyState).props('actionLabel')).toBe('All releases')
  })
})

describe('UiChangelog states', () => {
  it('keeps the page\'s head and offers the releases page when the list fails', async () => {
    configureReleases({ releasesUrl: 'https://example.test/releases' })
    vi.stubGlobal('fetch', vi.fn(async () => ({ ok: false, status: 500, json: async () => ({}) })))
    const wrapper = mountChangelog({}, { head: () => h('p', { class: 'intro' }, 'Intro') })
    await flushPromises()

    expect(wrapper.find('.intro').exists()).toBe(true)
    expect(wrapper.find('a[href="https://example.test/releases"]').exists()).toBe(true)
  })
})
