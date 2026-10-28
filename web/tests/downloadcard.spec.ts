// web/tests/downloadcard.spec.ts

import { createPinia } from 'pinia'
import { PiniaColada } from '@pinia/colada'
import { flushPromises, mount } from '@vue/test-utils'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import DownloadCard from '../src/components/releases/DownloadCard.vue'
import DownloadAssetRow from '../src/components/releases/DownloadAssetRow.vue'
import EmptyState from '../src/components/state/EmptyState.vue'
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
    expect(rows[0]!.props('primary')).toBe(true)
    expect(rows[1]!.props('primary')).toBe(false)
  })

  it('carries a version onto a platform that is a release behind', async () => {
    const wrapper = mountCard()
    await flushPromises()

    await wrapper.findAll('.v-tab')[1]!.trigger('click')
    await flushPromises()

    const row = wrapper.findComponent(DownloadAssetRow)
    // The header already says v2.0.0; only the platform that is behind names its build.
    expect(row.props('version')).toBe('v1.0.0')
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
})
