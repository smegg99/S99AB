// web/tests/downloadcard.spec.ts

import { createPinia } from 'pinia'
import { PiniaColada } from '@pinia/colada'
import { flushPromises, mount } from '@vue/test-utils'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import DownloadCard from '../src/components/releases/DownloadCard.vue'
import DownloadAssetRow from '../src/components/releases/DownloadAssetRow.vue'
import DownloadDialog from '../src/components/releases/DownloadDialog.vue'
import DownloadTabs from '../src/components/releases/DownloadTabs.vue'
import EmptyState from '../src/components/state/EmptyState.vue'
import { configureReleases, resetReleasesConfig } from '../src/composables/releases/internal/api'
import type { Downloads } from '../src/composables/releases/useReleases'
import { vuetify } from './mount'

function asset(name: string, platform: string, kind: string, arch = 'x86_64') {
  return {
    name,
    size: 1024,
    download_url: `https://d/${name}`,
    platform,
    arch,
    kind,
    digest: 'sha256:0123456789abcdef0123456789abcdef',
  }
}

// linux is current, macos is a release behind, and there is one checksum.
function payload(): Downloads {
  return {
    available: true,
    version: 'v2.0.0',
    published_at: '2026-07-01T00:00:00Z',
    html_url: 'https://example.test/v2',
    notes: '',
    notes_locale: 'en',
    platforms: [
      {
        platform: 'linux',
        version: 'v2.0.0',
        published_at: '2026-07-01T00:00:00Z',
        html_url: 'https://example.test/v2',
        current: true,
        assets: [asset('app.AppImage', 'linux', 'appimage'), asset('app.deb', 'linux', 'deb')],
      },
      {
        platform: 'macos',
        version: 'v1.0.0',
        published_at: '2026-06-01T00:00:00Z',
        html_url: 'https://example.test/v1',
        current: false,
        assets: [asset('app.dmg', 'macos', 'dmg', 'arm64')],
      },
    ],
    source: [],
    extras: [asset('checksums.txt', 'other', 'txt', '')],
  }
}

function stubApi(body: unknown, ok = true) {
  vi.stubGlobal('fetch', vi.fn(async () => ({
    ok,
    status: ok ? 200 : 500,
    json: async () => body,
  })))
}

function mountCard() {
  return mount(DownloadCard, {
    global: { plugins: [createPinia(), PiniaColada, vuetify] },
  })
}

beforeEach(() => {
  stubApi(payload())
})

afterEach(() => {
  vi.unstubAllGlobals()
  resetReleasesConfig()
})

describe('UiDownloadCard', () => {
  it('renders a tab per platform, plus one for what nobody picks by platform', async () => {
    const wrapper = mountCard()
    await flushPromises()

    const tabs = wrapper.findAll('.v-tab').map(t => t.text())
    expect(tabs).toHaveLength(3)
    expect(tabs[0]).toContain('Linux')
    expect(tabs[1]).toContain('macOS')
    // Checksums and source archives are not an OS build and get their own tab.
    expect(tabs[2]).toContain('Other files')
  })

  it('shows the open platform\'s formats, with its default first', async () => {
    const wrapper = mountCard()
    await flushPromises()

    const rows = wrapper.findAllComponents(DownloadAssetRow)
    expect(rows).toHaveLength(2)
    // AppImage is Linux's configured primary; the .deb beside it is not.
    expect(rows[0]!.props('row').primary).toBe(true)
    expect(rows[1]!.props('row').primary).toBe(false)
  })

  it('carries a version onto a platform that is a release behind', async () => {
    const wrapper = mountCard()
    await flushPromises()

    await wrapper.findAll('.v-tab')[1]!.trigger('click')
    await flushPromises()

    const row = wrapper.findComponent(DownloadAssetRow)
    // The header already says v2.0.0; only the platform that is behind names its build.
    expect(row.props('row').version).toBe('v1.0.0')
  })

  it('offers the releases page when there is nothing published', async () => {
    stubApi({ available: false })
    const wrapper = mountCard()
    await flushPromises()

    expect(wrapper.findComponent(EmptyState).exists()).toBe(true)
    expect(wrapper.find('.v-tab').exists()).toBe(false)
  })

  it('degrades the same way when the API answers an error', async () => {
    stubApi({}, false)
    const wrapper = mountCard()
    await flushPromises()

    // Unreachable and nothing published both point to the repository's releases.
    expect(wrapper.findComponent(EmptyState).exists()).toBe(true)
  })

  it('marks a planned platform and explains the marker under the card', async () => {
    configureReleases({ planned: ['windows'] })
    const wrapper = mountCard()
    await flushPromises()

    const windows = wrapper.findAll('.v-tab').find(t => t.text().includes('Windows'))!
    // A tab stays a tablist child and focusable, so its reason can be read.
    expect(windows.attributes('aria-disabled')).toBe('true')
    expect(windows.element.closest('[role="group"]')).toBeNull()
    expect(windows.find('.s99ab-downloads__mark').attributes('aria-hidden')).toBe('true')
    expect(windows.find('.s99ab-downloads__mark').text()).toBe('*')
    expect(windows.find('.d-sr-only').text()).toBe('(no build yet)')
    expect(wrapper.text()).toContain('* No build yet.')

    // Clicking it opens nothing.
    await windows.trigger('click')
    await flushPromises()
    expect(wrapper.findComponent(DownloadAssetRow).props('platform')).toBe('linux')
  })

  it('links the changelog and the releases page from config', async () => {
    configureReleases({ releasesUrl: 'https://example.test/releases', changelogPath: '/changelog' })
    const wrapper = mountCard()
    await flushPromises()

    // No router in a spec, so the changelog button keeps its route as a prop.
    const buttons = wrapper.findAllComponents({ name: 'VBtn' }).filter(b => b.element.closest('.s99ab-downloads__foot'))
    expect(buttons.map(b => b.props('to') ?? b.props('href'))).toEqual(['/changelog', 'https://example.test/releases'])
  })

  it('reports a download with its row and platform', async () => {
    const wrapper = mountCard()
    await flushPromises()

    await wrapper.findComponent(DownloadAssetRow).find('a').trigger('click')
    const [row, platform] = wrapper.emitted('download')![0] as [{ label: string }, string]
    expect(row.label).toBe('appimage')
    expect(platform).toBe('linux')
  })

  it('says an experimental tab is experimental', async () => {
    configureReleases({ experimental: ['macos'] })
    const wrapper = mountCard()
    await flushPromises()

    const macos = wrapper.findAll('.v-tab').find(t => t.text().includes('macOS'))!
    expect(macos.find('.s99ab-downloads__mark').text()).toBe('**')
    expect(macos.find('.d-sr-only').text()).toBe('(experimental)')
  })

  it('links fallback rows to the card\'s own releases page', async () => {
    configureReleases({ fallback: [{ platform: 'linux', assets: [{ kind: 'appimage' }] }] })
    stubApi({}, false)
    const wrapper = mount(DownloadCard, {
      props: { releasesUrl: 'https://example.test/releases' },
      global: { plugins: [createPinia(), PiniaColada, vuetify] },
    })
    await flushPromises()

    expect(wrapper.findComponent(DownloadAssetRow).props('row').url).toBe('https://example.test/releases')
  })
})

describe('UiDownloadDialog', () => {
  it('passes the notes and the planned reason through to the card', async () => {
    configureReleases({ planned: ['windows'], experimental: ['macos'] })
    const wrapper = mount(DownloadDialog, {
      props: { plannedNote: '* Soon.', experimentalNote: '** Try it.', plannedReason: 'Not yet.' },
      global: { plugins: [createPinia(), PiniaColada, vuetify] },
    })
    await flushPromises()

    const card = wrapper.findComponent(DownloadCard)
    expect(card.props('plannedNote')).toBe('* Soon.')
    expect(card.props('experimentalNote')).toBe('** Try it.')
    expect(card.findComponent(DownloadTabs).props('plannedReason')).toBe('Not yet.')
  })
})

describe('UiDownloadCard first load', () => {
  // The fallback is for a failed or empty answer, not the moment before the first one.
  it('shows no fallback rows while the first request is pending', async () => {
    configureReleases({ releasesUrl: 'https://example.test/releases', fallback: [{ platform: 'linux', assets: [{ kind: 'appimage' }] }] })
    vi.stubGlobal('fetch', vi.fn(() => new Promise(() => {})))
    const wrapper = mountCard()
    await flushPromises()

    expect(wrapper.findComponent(DownloadAssetRow).exists()).toBe(false)
  })
})
