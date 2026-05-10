// web/src/composables/releases/useReleases.ts

// Client for the layer's releases endpoints (see apireleases.Register). Called
// directly, since both ends ship in this layer.

import { useQuery } from '@pinia/colada'
import { computed, type DeepReadonly, reactive, readonly } from 'vue'
import { useLocale } from '../useTranslate'

export interface ReleaseAsset {
  name: string
  size: number
  download_url: string
  /** linux | windows | macos | source | other */
  platform: string
  /** x86_64 | arm64 | universal | "" */
  arch: string
  /** appimage | deb | rpm | tar.gz | exe | installer | msix | zip | dmg | ... */
  kind: string
  /**
   * GitHub's checksum as "algo:hex", empty when GitHub has none. Catches a
   * truncated or altered download, but it is not a signature.
   */
  digest: string
}

export interface Release {
  available: boolean
  version: string
  name: string
  published_at: string
  html_url: string
  assets: ReleaseAsset[]
  /** The zip and tarball GitHub builds from the tag. No size, no digest. */
  source: ReleaseAsset[]
  /** Markdown, in `notes_locale`. */
  notes: string
  notes_locale: string
}

/** One platform's newest build, and the release it came from. */
export interface PlatformBuild {
  platform: string
  version: string
  published_at: string
  html_url: string
  /** False when this build predates the newest release. */
  current: boolean
  assets: ReleaseAsset[]
}

export interface Downloads {
  available: boolean
  version: string
  published_at: string
  html_url: string
  notes: string
  notes_locale: string
  platforms: PlatformBuild[]
  source: ReleaseAsset[]
  extras: ReleaseAsset[]
}

export interface RepoStats {
  available: boolean
  stars: number
  forks: number
  html_url: string
}

export interface ReleasesConfig {
  apiBase: string
  /** Platform tab order. A platform with no build is not shown. */
  order: string[]
  /** The format each platform is offered first. Others stay available. */
  primaryKind: Record<string, string>
  icons: Record<string, string>
  /** How long a fetched list is reused, in ms. The server caches too. */
  staleTime: number
}

const config = reactive<ReleasesConfig>({
  apiBase: '/api/v1',
  order: ['linux', 'windows', 'macos'],
  // AppImage runs anywhere; Windows users expect the NSIS installer.
  primaryKind: { linux: 'appimage', windows: 'installer' },
  icons: {
    linux: 'mdi-linux',
    windows: 'mdi-microsoft-windows',
    macos: 'mdi-apple',
    android: 'mdi-android',
    ios: 'mdi-apple-ios',
    source: 'mdi-code-tags',
    extras: 'mdi-file-document-outline',
  },
  staleTime: 5 * 60_000,
})

/** Called by the layer's Nuxt plugin with the app's s99ab.releases config. */
export function configureReleases(patch: Partial<ReleasesConfig>) {
  const { primaryKind, icons, ...rest } = patch
  Object.assign(config, rest)
  if (primaryKind) Object.assign(config.primaryKind, primaryKind)
  if (icons) Object.assign(config.icons, icons)
}

/** The live config, deeply readonly. */
export function useReleasesConfig(): DeepReadonly<ReleasesConfig> {
  return readonly(config)
}

export async function fetchFromApi<T>(path: string, locale = ''): Promise<T> {
  const query = locale ? `?locale=${encodeURIComponent(locale)}` : ''
  const res = await fetch(`${config.apiBase}${path}${query}`, {
    headers: { Accept: 'application/json' },
  })
  if (!res.ok) throw new Error(`s99ab: ${path} answered ${res.status}`)
  return (await res.json()) as T
}

/** Query keys include the locale, so switching language refetches the notes. */
function keyed(name: string, locale: string) {
  return ['s99ab', name, locale] as const
}

/** The newest stable release. */
export function useLatestRelease() {
  const locale = useLocale()

  return useQuery({
    key: () => [...keyed('release', locale.value)],
    query: () => fetchFromApi<Release>('/releases/latest', locale.value),
    staleTime: config.staleTime,
  })
}

/** The download card's whole model, in one request. */
export function useDownloads() {
  const locale = useLocale()

  return useQuery({
    key: () => [...keyed('downloads', locale.value)],
    query: () => fetchFromApi<Downloads>('/downloads', locale.value),
    staleTime: config.staleTime,
  })
}

/** Every stable release, newest first. Drafts and prereleases never arrive. */
export function useChangelog() {
  const locale = useLocale()

  const q = useQuery({
    key: () => [...keyed('changelog', locale.value)],
    query: () =>
      fetchFromApi<{ releases: Release[] }>('/releases', locale.value).then(
        r => r.releases ?? [],
      ),
    staleTime: config.staleTime,
  })

  return { ...q, releases: computed(() => q.data.value ?? []) }
}

/** The repository's own star and fork counts. */
export function useRepoStats() {
  return useQuery({
    key: ['s99ab', 'repo'],
    query: () => fetchFromApi<RepoStats>('/repo'),
    staleTime: config.staleTime,
  })
}

/** Fallback platform names when the app has no string for one. */
export const PLATFORM_NAMES: Record<string, string> = {
  linux: 'Linux',
  windows: 'Windows',
  macos: 'macOS',
  android: 'Android',
  ios: 'iOS',
  source: 'Source',
  extras: 'Other files',
}

/** Human-readable size. Empty for the assets GitHub reports no size for. */
export function formatBytes(bytes: number): string {
  if (!bytes || bytes <= 0) return ''

  const units = ['B', 'KB', 'MB', 'GB']
  let value = bytes
  let unit = 0
  while (value >= 1024 && unit < units.length - 1) {
    value /= 1024
    unit++
  }
  return unit === 0 ? `${value} ${units[unit]}` : `${value.toFixed(1)} ${units[unit]}`
}

/** vue-i18n treats dots as path steps, so "tar.gz" is looked up as targz. */
export function kindKey(kind: string): string {
  return kind.replace(/\./g, '')
}
