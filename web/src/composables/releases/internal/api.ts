// web/src/composables/releases/internal/api.ts

import { reactive } from 'vue'
import type { ReleasesConfig } from '../useReleases'

export const config = reactive<ReleasesConfig>({
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

export async function fetchFromApi<T>(path: string, locale = ''): Promise<T> {
  const query = locale ? `?locale=${encodeURIComponent(locale)}` : ''
  const res = await fetch(`${config.apiBase}${path}${query}`, {
    headers: { Accept: 'application/json' },
  })
  if (!res.ok) throw new Error(`s99ab: ${path} answered ${res.status}`)
  return (await res.json()) as T
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
