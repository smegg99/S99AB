// web/tests/releases.spec.ts

import { afterEach, describe, expect, it, vi } from 'vitest'
import { fetchFromApi, formatBytes, kindKey } from '../src/composables/releases/internal/api'
import { formatCount } from '../src/composables/releases/internal/count'
import { formatReleaseDate } from '../src/composables/releases/internal/date'
import { detectOS } from '../src/internal/platform'
import { compareVersions } from '../src/composables/releases/internal/version'

describe('compareVersions', () => {
  it('orders by number, not by text', () => {
    // A string compare would put "1.10.0" before "1.9.0".
    expect(compareVersions('1.9.0', '1.10.0')).toBeLessThan(0)
    expect(compareVersions('2.0.0', '1.99.99')).toBeGreaterThan(0)
    expect(compareVersions('1.2.3', 'v1.2.3')).toBe(0)
  })

  it('treats missing parts as zero', () => {
    expect(compareVersions('1.2', '1.2.0')).toBe(0)
    expect(compareVersions('1', '1.0.1')).toBeLessThan(0)
  })

  it('sorts a prerelease below the release it leads to', () => {
    expect(compareVersions('1.2.0-rc1', '1.2.0')).toBeLessThan(0)
    expect(compareVersions('1.2.0-rc1', '1.2.0-rc2')).toBeLessThan(0)
  })

  // An unparseable tag must not read as "behind", or a date-stamped build always asks to update.
  it('compares equal when either side is unparseable', () => {
    expect(compareVersions('nightly', '1.2.3')).toBe(0)
    expect(compareVersions('', '1.2.3')).toBe(0)
  })
})

describe('detectOS', () => {
  it('reads the three desktop platforms', () => {
    expect(detectOS('Mozilla/5.0 (X11; Linux x86_64)')).toBe('linux')
    expect(detectOS('Mozilla/5.0 (Windows NT 10.0; Win64; x64)')).toBe('windows')
    expect(detectOS('Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7)')).toBe('macos')
  })

  // "darwin" contains "win", so check order matters.
  it('does not read a Mac as Windows', () => {
    expect(detectOS('darwin')).toBe('macos')
  })

  // An iPhone matches /mac/ and an Android phone /linux/, so handhelds are read first.
  it('names a handheld rather than guessing a desktop', () => {
    expect(detectOS('Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X)')).toBe('ios')
    expect(detectOS('Mozilla/5.0 (Linux; Android 14)')).toBe('android')
  })
})

describe('formatBytes', () => {
  it('scales to the unit that reads', () => {
    expect(formatBytes(512)).toBe('512 B')
    expect(formatBytes(2048)).toBe('2.0 KB')
    expect(formatBytes(5 * 1024 * 1024)).toBe('5.0 MB')
  })

  // GitHub reports no size for source archives; "0 B" would suggest an empty file.
  it('says nothing when the size is unknown', () => {
    expect(formatBytes(0)).toBe('')
  })
})

// vue-i18n reads a dot as a path step, so tar.gz would look up tar -> gz.
describe('kindKey', () => {
  it('flattens a dotted format name', () => {
    expect(kindKey('tar.gz')).toBe('targz')
    expect(kindKey('pkg.tar.zst')).toBe('pkgtarzst')
    expect(kindKey('appimage')).toBe('appimage')
  })
})

describe('formatReleaseDate', () => {
  it('writes a long date in the given locale', () => {
    expect(formatReleaseDate('2026-07-01T12:00:00Z', 'en')).toBe('July 1, 2026')
    expect(formatReleaseDate('2026-07-01T12:00:00Z', 'pl')).toBe('1 lipca 2026')
  })

  it('says nothing for a missing or broken timestamp', () => {
    expect(formatReleaseDate(undefined, 'en')).toBe('')
    expect(formatReleaseDate('soon', 'en')).toBe('')
  })
})

describe('formatCount', () => {
  it('compacts thousands in the reader\'s locale', () => {
    expect(formatCount(950, 'en')).toBe('950')
    expect(formatCount(1234, 'en')).toBe('1.2K')
  })
})

describe('fetchFromApi', () => {
  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('passes the abort signal to fetch', async () => {
    const fetch = vi.fn(async () => ({ ok: true, status: 200, json: async () => ({}) }))
    vi.stubGlobal('fetch', fetch)
    const signal = new AbortController().signal

    await fetchFromApi('/repo', '', signal)
    expect(fetch).toHaveBeenCalledWith('/api/v1/repo', expect.objectContaining({ signal }))
  })
})

// The server renders in UTC; a local timezone would move a midnight release a day and break hydration.
describe('formatReleaseDate in UTC', () => {
  it('reads the date in UTC, not the machine timezone', () => {
    expect(formatReleaseDate('2026-07-01T23:30:00Z', 'en')).toBe('July 1, 2026')
    expect(formatReleaseDate('2026-07-02T00:30:00+02:00', 'en')).toBe('July 1, 2026')
  })
})
