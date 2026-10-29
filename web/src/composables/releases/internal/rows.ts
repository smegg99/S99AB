// web/src/composables/releases/internal/rows.ts

import type { DeepReadonly } from 'vue'
import { formatBytes, kindKey } from './api'
import type { FallbackPlatform, ReleaseAsset } from '../useReleases'
import type { Translate } from '../../useTranslate'

/** One downloadable file as a row shows it; built here so the row stays presentational. */
export interface DownloadRow {
  key: string
  label: string
  sub: string
  /** '' when the label already is the filename, or for a fallback row. */
  filename: string
  size: string
  url: string
  digest: string
  /** kindKey of the format, for tracking. */
  kind: string
  primary: boolean
  /** Set only when this build is behind the newest release. */
  version: string
}

/** One tab of the download card. */
export interface DownloadGroup {
  key: string
  name: string
  icon: string
  /** No build yet: the tab is shown disabled. */
  planned: boolean
  experimental: boolean
  version: string
  rows: DownloadRow[]
}

function kindLabel(t: Translate, kind: string): string {
  return t(`release.kinds.${kindKey(kind)}`, kind)
}

/** A platform's live build, its primary format first in the list order it came in. */
export function liveRows(t: Translate, platform: string, assets: ReleaseAsset[], primaryKind: string, version: string): DownloadRow[] {
  const web = platform === 'web'
  return assets.map(a => ({
    key: a.name,
    label: web ? t('release.webBuild', 'Web edition') : kindLabel(t, a.kind),
    sub: web ? t('release.webBuildSub', 'Static site, host it yourself') : a.arch,
    filename: a.name,
    size: formatBytes(a.size),
    url: a.download_url,
    digest: a.digest,
    kind: kindKey(a.kind),
    primary: a.kind === primaryKind,
    version,
  }))
}

/** Checksums and signatures by filename, the tag's source archives by format. */
export function extraRows(t: Translate, extras: ReleaseAsset[], source: ReleaseAsset[]): DownloadRow[] {
  const row = (a: ReleaseAsset, label: string, filename: string): DownloadRow => ({
    key: a.name, label, sub: '', filename, size: formatBytes(a.size), url: a.download_url,
    digest: a.digest, kind: kindKey(a.kind), primary: false, version: '',
  })
  return [
    ...extras.map(a => row(a, a.name, '')),
    ...source.map(a => row(a, t(`release.source.${kindKey(a.kind)}`, a.name), a.name)),
  ]
}

/** The configured stand-in rows, each linking to the releases page. */
export function fallbackRows(t: Translate, platform: DeepReadonly<FallbackPlatform>, primaryKind: string, url: string): DownloadRow[] {
  return platform.assets.map(a => ({
    key: `${platform.platform}-${a.kind}`,
    label: platform.platform === 'web' ? t('release.webBuild', 'Web edition') : kindLabel(t, a.kind),
    sub: a.subKey ? t(a.subKey, '') : '',
    filename: '',
    size: '',
    url,
    digest: '',
    kind: kindKey(a.kind),
    primary: a.kind === primaryKind,
    version: '',
  }))
}
