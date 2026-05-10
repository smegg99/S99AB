// web/src/composables/releases/useUpdateCheck.ts

// Compares the running build (apihealth /version) with the newest release
// (apireleases /releases/latest).

import { computed, type MaybeRefOrGetter, toValue } from 'vue'
import { useBuildVersion } from './useBuildVersion'
import { useLatestRelease } from './useReleases'

/**
 * Compares release tags: optional leading v, numeric parts, prereleases below
 * their release. Returns <0, 0 or >0; unparseable input compares equal.
 */
export function compareVersions(a: string, b: string): number {
  const parse = (raw: string) => {
    const m = /^v?(\d+)(?:\.(\d+))?(?:\.(\d+))?(?:[-+](.*))?$/.exec(raw.trim())
    if (!m) return null
    return {
      nums: [Number(m[1]), Number(m[2] ?? 0), Number(m[3] ?? 0)],
      pre: m[4] ?? '',
    }
  }

  const left = parse(a)
  const right = parse(b)
  if (!left || !right) return 0

  for (let i = 0; i < 3; i++) {
    if (left.nums[i]! !== right.nums[i]!) return left.nums[i]! - right.nums[i]!
  }
  if (left.pre === right.pre) return 0
  // A prerelease is behind the plain version; two prereleases compare as text.
  if (!left.pre) return 1
  if (!right.pre) return -1
  return left.pre < right.pre ? -1 : 1
}

export interface UpdateCheckOptions {
  /** The running version. Defaults to /version; a desktop shell passes its build constant. */
  current?: MaybeRefOrGetter<string | undefined>
}

/** Whether a newer release exists. An empty (dev) version is never behind. */
export function useUpdateCheck(options: UpdateCheckOptions = {}) {
  const build = useBuildVersion()
  const latest = useLatestRelease()

  const current = computed(
    () => toValue(options.current) ?? build.version.value,
  )
  const latestVersion = computed(() =>
    latest.data.value?.available ? latest.data.value.version : '',
  )

  const behind = computed(() => {
    if (!current.value || !latestVersion.value) return false
    return compareVersions(current.value, latestVersion.value) < 0
  })

  return {
    current,
    latest: computed(() => latest.data.value ?? null),
    latestVersion,
    behind,
    /** True until both halves have answered, so a banner can wait them out. */
    checking: computed(
      () => build.loading.value || latest.asyncStatus.value === 'loading',
    ),
    refresh: () => Promise.all([build.refresh(), latest.refetch()]),
  }
}
