<!-- web/src/components/auth/AuthBuild.vue -->
<template>
  <div v-if="version">
    <dt>{{ t('auth.version', 'version') }}</dt>
    <dd>{{ version }}</dd>
  </div>
  <div v-if="commit">
    <dt>{{ t('auth.commit', 'commit') }}</dt>
    <dd>{{ commit }}</dd>
  </div>
  <div v-if="builtAt">
    <dt>{{ t('auth.built', 'built') }}</dt>
    <dd>{{ builtAt }}</dd>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { formatReleaseDate } from '../../composables/releases/internal/date'
import { useBuildVersion } from '../../composables/releases/useBuildVersion'
import { useTranslate } from '../../composables/useTranslate'

// The plate's rows from /version. A separate component so `v-if` keeps
// useQuery (and Pinia) out of a sign-in form that does not ask for `build`.
const t = useTranslate()
const { version, commit, buildTime } = useBuildVersion()

const builtAt = computed(() => formatReleaseDate(buildTime.value))
</script>
