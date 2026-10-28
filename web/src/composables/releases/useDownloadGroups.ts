// web/src/composables/releases/useDownloadGroups.ts

import { computed, type MaybeRefOrGetter, ref, toValue, watch } from 'vue'
import { usePlatform } from '../usePlatform'
import { type Downloads, type ReleaseAsset, useReleasesConfig } from './useReleases'
import { PLATFORM_NAMES } from './internal/api'
import { useTranslate } from '../useTranslate'

/** One tab of the download card, and everything it offers. */
export interface DownloadGroup {
  key: string
  name: string
  icon: string
  /** Set only when this platform is behind the newest release. */
  version: string
  primaryKind: string
  assets: ReleaseAsset[]
}

/**
 * Turns a downloads payload into the card's tabs and holds the open one. Call
 * from setup: it reads i18n and detects the OS on mount.
 */
export function useDownloadGroups(source: MaybeRefOrGetter<Downloads | null>) {
  const t = useTranslate()
  const config = useReleasesConfig()
  const { os } = usePlatform()

  const tab = ref('')
  const userPicked = ref(false)

  // Platforms in configured order, then one tab for sources, checksums and signatures.
  const groups = computed<DownloadGroup[]>(() => {
    const d = toValue(source)
    if (!d?.available) return []

    const byPlatform = new Map(d.platforms.map(p => [p.platform, p]))
    const ordered = [
      ...config.order.filter(key => byPlatform.has(key)),
      ...d.platforms.map(p => p.platform).filter(key => !config.order.includes(key)),
    ]

    const out: DownloadGroup[] = ordered.map((key) => {
      const p = byPlatform.get(key)!
      return {
        key,
        name: t(`release.platforms.${key}`, PLATFORM_NAMES[key] ?? key),
        icon: config.icons[key] ?? '',
        // Otherwise it would repeat the version in the header.
        version: p.current ? '' : p.version,
        primaryKind: config.primaryKind[key] ?? '',
        assets: p.assets,
      }
    })

    const extras = [...(d.extras ?? []), ...(d.source ?? [])]
    if (extras.length) {
      out.push({
        key: 'extras',
        name: t('release.platforms.extras', PLATFORM_NAMES.extras!),
        icon: config.icons.extras ?? '',
        version: '',
        primaryKind: '',
        assets: extras,
      })
    }
    return out
  })

  const detected = computed(() =>
    groups.value.some(g => g.key === os.value) ? os.value : '',
  )

  const current = computed(
    () => groups.value.find(g => g.key === tab.value) ?? groups.value[0],
  )

  // Follow the detected platform until the user picks a tab. A pick the newest
  // payload does not offer is dropped, so v-tabs always has a selection.
  watch(
    [detected, groups],
    () => {
      if (userPicked.value && groups.value.some(g => g.key === tab.value)) return
      userPicked.value = false
      tab.value = detected.value || groups.value[0]?.key || ''
    },
    { immediate: true },
  )

  watch(tab, (next) => {
    if (next && next !== (detected.value || groups.value[0]?.key)) userPicked.value = true
  })

  return { groups, detected, tab, current }
}
