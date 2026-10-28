// web/src/composables/releases/useUpdateCheck.ts

// Compares the running build (apihealth /version) with the newest release
// (apireleases /releases/latest).

import { computed, type MaybeRefOrGetter, toValue } from 'vue'
import { useBuildVersion } from './useBuildVersion'
import { useLatestRelease } from './useReleases'
import { compareVersions } from './internal/version'

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
