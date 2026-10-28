// web/src/composables/releases/useReleases.ts

// Client for the layer's releases endpoints (see apireleases.Register). Called
// directly, since both ends ship in this layer.

import { useQuery } from '@pinia/colada'
import { computed, type DeepReadonly, readonly } from 'vue'
import { useLocale } from '../useTranslate'

import { config, fetchFromApi } from './internal/api'

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

/** The live config, deeply readonly. */
export function useReleasesConfig(): DeepReadonly<ReleasesConfig> {
  return readonly(config)
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
