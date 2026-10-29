<!-- web/src/components/auth/AuthBuild.vue -->
<template>
  <div v-if="version">
    <dt>{{ versionLabel }}</dt>
    <dd>{{ version }}</dd>
  </div>
  <div v-if="commit">
    <dt>{{ commitLabel }}</dt>
    <dd>{{ commit }}</dd>
  </div>
  <div v-if="builtAt">
    <dt>{{ builtLabel }}</dt>
    <dd>{{ builtAt }}</dd>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { formatReleaseDate } from '../../composables/releases/internal/date'
import { useBuildVersion } from '../../composables/releases/useBuildVersion'
import { useLocale, useTranslate } from '../../composables/useTranslate'

// The plate's rows from /version. A separate component so `v-if` keeps
// useQuery (and Pinia) out of a sign-in form that does not ask for `build`.
const t = useTranslate()
const versionLabel = computed(() => t('auth.version', 'version'))
const commitLabel = computed(() => t('auth.commit', 'commit'))
const builtLabel = computed(() => t('auth.built', 'built'))
const { version, commit, buildTime } = useBuildVersion()

const locale = useLocale()
const builtAt = computed(() => formatReleaseDate(buildTime.value, locale.value))
</script>
