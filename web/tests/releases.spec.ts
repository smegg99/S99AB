// web/tests/releases.spec.ts

import { describe, expect, it } from 'vitest'
import { formatBytes, kindKey } from '../src/composables/releases/useReleases'
import { detectOS } from '../src/composables/usePlatform'
import { compareVersions } from '../src/composables/releases/useUpdateCheck'

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

  // An iPhone matches /mac/ and would be offered a .dmg.
  it('calls a handheld other rather than guessing a desktop', () => {
    expect(detectOS('Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X)')).toBe('other')
    expect(detectOS('Mozilla/5.0 (Linux; Android 14)')).toBe('other')
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
