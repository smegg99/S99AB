// web/tests/downloadgroups.spec.ts

import { defineComponent, nextTick, ref } from 'vue'
import { mount } from '@vue/test-utils'
import { afterEach, describe, expect, it } from 'vitest'
import { createI18n } from 'vue-i18n'
import { withS99ab } from '../i18n'
import { configureReleases, resetReleasesConfig } from '../src/composables/releases/internal/api'
import { useDownloadGroups } from '../src/composables/releases/useDownloadGroups'
import type { Downloads, ReleaseAsset } from '../src/composables/releases/useReleases'

function asset(name: string, platform: string, kind: string, arch = 'x86_64'): ReleaseAsset {
  return { name, size: 2048, download_url: `https://d/${name}`, platform, arch, kind, digest: 'sha256:00' }
}

function payload(): Downloads {
  return {
    available: true, version: 'v2.0.0', published_at: '', html_url: '', notes: '', notes_locale: 'en',
    platforms: [
      { platform: 'linux', version: 'v2.0.0', published_at: '', html_url: '', current: true,
        assets: [asset('app.deb', 'linux', 'deb'), asset('app.AppImage', 'linux', 'appimage')] },
      { platform: 'web', version: 'v1.0.0', published_at: '', html_url: '', current: false,
        assets: [asset('app-web.tar.zst', 'web', 'tar.zst', '')] },
    ],
    source: [asset('app-2.0.0.zip', 'source', 'zip', '')],
    extras: [asset('checksums.txt', 'other', 'txt', '')],
  }
}

function groupsOf(downloads: Downloads | null) {
  const source = ref<Downloads | null>(downloads)
  let api!: ReturnType<typeof useDownloadGroups>
  mount(defineComponent({
    setup() {
      api = useDownloadGroups(source)
      return () => null
    },
  }), { global: { plugins: [createI18n({ legacy: false, globalInjection: true, locale: 'en', messages: withS99ab({ en: {}, pl: {} }) })] } })
  return { api, source }
}

afterEach(() => {
  resetReleasesConfig()
})

describe('useDownloadGroups', () => {
  it('builds rows the card only has to show', () => {
    const { api } = groupsOf(payload())
    const linux = api.groups.value[0]!
    expect(linux.rows.map(r => [r.label, r.sub, r.primary])).toEqual([
      ['Debian package', 'x86_64', false],
      ['AppImage', 'x86_64', true],
    ])
    expect(linux.rows[0]!.size).toBe('2.0 KB')
  })

  it('names the web build and keeps the version of a platform that is behind', () => {
    const { api } = groupsOf(payload())
    const web = api.groups.value.find(g => g.key === 'web')!
    expect(web.version).toBe('v1.0.0')
    expect(web.rows[0]).toMatchObject({ label: 'Web edition', sub: 'Static site, host it yourself', primary: true })
  })

  it('labels extras by filename and source archives by format', () => {
    const { api } = groupsOf(payload())
    const extras = api.groups.value.at(-1)!
    expect(extras.key).toBe('extras')
    expect(extras.rows.map(r => [r.label, r.filename])).toEqual([
      ['checksums.txt', ''],
      ['Source code (zip)', 'app-2.0.0.zip'],
    ])
  })

  it('shows a planned platform as a disabled tab that a real build replaces', () => {
    configureReleases({ planned: ['macos', 'web'], experimental: ['web'] })
    const { api } = groupsOf(payload())
    const keys = api.groups.value.map(g => [g.key, g.planned, g.experimental])
    expect(keys).toEqual([
      ['linux', false, false],
      ['macos', true, false],
      ['web', false, true],
      ['extras', false, false],
    ])
  })

  it('falls back to the configured rows when nothing is published', () => {
    configureReleases({
      releasesUrl: 'https://example.test/releases',
      fallback: [{ platform: 'windows', assets: [{ kind: 'installer', subKey: 'missing.key' }] }],
    })
    const { api } = groupsOf({ ...payload(), available: false, platforms: [] })
    expect(api.live.value).toBe(false)
    expect(api.groups.value).toHaveLength(1)
    expect(api.groups.value[0]!.rows[0]).toMatchObject({
      label: 'Installer', url: 'https://example.test/releases', primary: true, filename: '',
    })
  })

  it('has no tabs when nothing is published and there is no fallback', () => {
    configureReleases({ planned: ['macos'] })
    const { api } = groupsOf({ ...payload(), available: false, platforms: [] })
    expect(api.groups.value).toEqual([])
  })

  it('opens the first tab with builds, keeps a pick, and refuses a planned one', async () => {
    configureReleases({ planned: ['macos'] })
    const { api, source } = groupsOf(payload())
    expect(api.tab.value).toBe('linux')

    api.pick('web')
    api.pick('macos')
    expect(api.tab.value).toBe('web')

    source.value = { ...payload() }
    await nextTick()
    expect(api.tab.value).toBe('web')
    expect(api.current.value?.key).toBe('web')
  })
})
