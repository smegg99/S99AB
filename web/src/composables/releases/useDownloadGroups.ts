// web/src/composables/releases/useDownloadGroups.ts

import { computed, type MaybeRefOrGetter, readonly, ref, toValue, watch } from 'vue'
import { usePlatform } from '../usePlatform'
import { type Downloads, useReleasesConfig } from './useReleases'
import { PLATFORM_NAMES } from './internal/api'
import { type DownloadGroup, extraRows, fallbackRows, liveRows } from './internal/rows'
import { useTranslate } from '../useTranslate'

export type { DownloadGroup, DownloadRow } from './internal/rows'

export interface DownloadGroupsOptions {
  /** Where fallback rows link; s99ab.releases.releasesUrl when unset. */
  releasesUrl?: MaybeRefOrGetter<string | undefined>
}

/**
 * The download card's tabs and the open one: live builds, the configured fallback when there are none,
 * and planned platforms as disabled tabs. Call from setup.
 */
export function useDownloadGroups(source: MaybeRefOrGetter<Downloads | null>, options: DownloadGroupsOptions = {}) {
  const t = useTranslate()
  const config = useReleasesConfig()
  const { os } = usePlatform()

  // A published release, even one whose platform builds are not uploaded yet.
  const live = computed(() => !!toValue(source)?.available)
  const releasesUrl = computed(() => toValue(options.releasesUrl) ?? config.releasesUrl)

  function group(key: string, rows: DownloadGroup['rows'], version = ''): DownloadGroup {
    return {
      key,
      name: t(`release.platforms.${key}`, PLATFORM_NAMES[key] ?? key),
      icon: config.icons[key] ?? '',
      planned: rows.length === 0,
      experimental: config.experimental.includes(key),
      version,
      rows,
    }
  }

  // Nuxt concatenates app.config arrays, so the configured order may repeat a platform.
  function ordered(keys: string[]): string[] {
    return [...new Set([...config.order.filter(k => keys.includes(k)), ...keys])]
  }

  const groups = computed<DownloadGroup[]>(() => {
    const d = toValue(source)
    const built = new Map<string, DownloadGroup>()

    if (d?.available && d.platforms.length) {
      for (const p of d.platforms) {
        // Otherwise it would repeat the version in the header.
        const version = p.current ? '' : p.version
        built.set(p.platform, group(p.platform, liveRows(t, p.platform, p.assets, config.primaryKind[p.platform] ?? '', version), version))
      }
    }
    // Fallback rows link to the releases page, so without one there is nothing to offer.
    else if (releasesUrl.value) {
      for (const f of config.fallback) {
        built.set(f.platform, group(f.platform, fallbackRows(t, f, config.primaryKind[f.platform] ?? '', releasesUrl.value)))
      }
    }
    if (live.value || built.size) {
      for (const key of config.planned) if (!built.has(key)) built.set(key, group(key, []))
    }

    const out = ordered([...built.keys()]).map(k => built.get(k)!)
    const extras = live.value && d ? extraRows(t, d.extras ?? [], d.source ?? []) : []
    if (extras.length) out.push({ ...group('extras', extras), name: t('release.platforms.extras', PLATFORM_NAMES.extras!) })
    return out
  })

  const detected = computed(() => (groups.value.some(g => g.key === os.value) ? os.value : ''))

  const tab = ref('')
  let picked = false

  function firstOpen(): string {
    const own = groups.value.find(g => g.key === detected.value && !g.planned)
    return own?.key ?? groups.value.find(g => !g.planned)?.key ?? ''
  }

  // Follows the detected platform until the user picks a tab; a pick the payload no longer offers is dropped.
  watch([detected, groups], () => {
    if (picked && groups.value.some(g => g.key === tab.value && !g.planned)) return
    picked = false
    tab.value = firstOpen()
  }, { immediate: true })

  function pick(key: string) {
    if (!groups.value.some(g => g.key === key && !g.planned)) return
    picked = true
    tab.value = key
  }

  const current = computed(() => groups.value.find(g => g.key === tab.value))

  return { groups, detected, tab: readonly(tab), current, live, pick }
}
