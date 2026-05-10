// web/src/composables/releases/useBuildVersion.ts

// The running build, as apihealth's /version reports it. Shared by the update
// check and the sign-in card's plate; UiAuthCard takes the build as props.

import { useQuery } from '@pinia/colada'
import { computed, type MaybeRefOrGetter } from 'vue'
import { fetchFromApi, useReleasesConfig } from './useReleases'

export interface BuildVersion {
  version: string
  commit: string
  build_time: string
}

export interface BuildVersionOptions {
  /** Default true. Off for a caller that already knows its build. */
  enabled?: MaybeRefOrGetter<boolean>
}

/** A dev build reports empty strings; `known` tells whether there is a version. */
export function useBuildVersion(options: BuildVersionOptions = {}) {
  const config = useReleasesConfig()

  const query = useQuery({
    key: ['s99ab', 'version'],
    query: () => fetchFromApi<BuildVersion>('/version'),
    staleTime: config.staleTime,
    enabled: options.enabled ?? true,
  })

  const build = computed(() => query.data.value ?? null)

  return {
    build,
    version: computed(() => build.value?.version ?? ''),
    commit: computed(() => build.value?.commit ?? ''),
    buildTime: computed(() => build.value?.build_time ?? ''),
    known: computed(() => Boolean(build.value?.version || build.value?.commit)),
    loading: computed(() => query.asyncStatus.value === 'loading'),
    refresh: () => query.refetch(),
  }
}
