<!-- web/src/components/releases/DownloadCard.vue -->
<template>
  <v-card>
    <UiLoadingState
      v-if="firstLoad"
      :rows="3"
      variant="skeleton"
      lines="one"
    />

    <!-- Before the first answer, and before the delayed skeleton shows, the card stays empty. -->
    <template v-else-if="pending" />

    <!-- Nothing published or GitHub unreachable, and no configured fallback: point to the releases page. -->
    <slot
      v-else-if="!groups.length"
      name="unavailable"
    >
      <UiEmptyState
        :title="emptyTitle"
        :text="emptyText"
        :action-label="emptyAction"
        icon="mdi-package-variant"
        @action="open(allReleasesUrl)"
      />
    </slot>

    <template v-else>
      <div
        v-if="live && downloads"
        class="s99ab-downloads__head s99ab-controls"
      >
        <span class="font-weight-bold s99ab-downloads__version">{{ downloads.version }}</span>
        <v-chip
          size="small"
          color="accent"
          variant="flat"
        >
          {{ latestLabel }}
        </v-chip>
        <time
          v-if="published"
          :datetime="downloads.published_at"
          class="text-body-small text-medium-emphasis"
        >{{ published }}</time>
        <v-spacer />
        <slot name="actions" />
      </div>

      <UiDownloadTabs
        :groups="groups"
        :detected="detected"
        :model-value="tab"
        :planned-reason="plannedReason"
        @select="select"
      />

      <div
        v-if="current"
        class="s99ab-downloads__rows"
      >
        <UiDownloadAssetRow
          v-for="row in current.rows"
          :key="row.key"
          :row="row"
          :platform="current.key"
          @download="emit('download', row, current.key)"
          @copy-digest="emit('copyDigest', row, current.key)"
        />
      </div>

      <div
        v-if="notes.length || changelogTo || allReleasesUrl"
        class="s99ab-downloads__foot text-body-small text-medium-emphasis"
      >
        <p
          v-for="note in notes"
          :key="note"
        >
          {{ note }}
        </p>
        <div class="d-flex flex-wrap ga-2">
          <v-btn
            v-if="changelogTo"
            :to="changelogTo"
            variant="text"
            size="small"
          >
            {{ changelogLabel }}
          </v-btn>
          <v-btn
            v-if="allReleasesUrl"
            :href="allReleasesUrl"
            :data-umami-event="config.umami ? 'all-releases' : undefined"
            variant="text"
            size="small"
            append-icon="mdi-open-in-new"
            target="_blank"
            rel="noopener"
          >
            {{ allReleasesLabel }}
          </v-btn>
        </div>
      </div>
    </template>
    <slot name="foot" />
  </v-card>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import UiEmptyState from '../state/EmptyState.vue'
import UiLoadingState from '../state/LoadingState.vue'
import UiDownloadAssetRow from './DownloadAssetRow.vue'
import UiDownloadTabs from './DownloadTabs.vue'
import { useDelayed } from '../../composables/useDelay'
import { type DownloadRow, useDownloadGroups } from '../../composables/releases/useDownloadGroups'
import { formatReleaseDate } from '../../composables/releases/internal/date'
import { useDownloads, useReleasesConfig } from '../../composables/releases/useReleases'
import { useLocale, useTranslate } from '../../composables/useTranslate'
import { inBrowser } from '../../browser/env'

// The newest version, a tab per platform with the user's marked, and every format that platform ships.
const { releasesUrl, changelogPath, plannedNote = '', experimentalNote = '', plannedReason = '' } = defineProps<{
  /** The releases page; overrides s99ab.releases.releasesUrl. */
  releasesUrl?: string
  /** The changelog route; overrides s99ab.releases.changelogPath. */
  changelogPath?: string
  /** Shown under the card when a tab is planned; the layer's text when empty. */
  plannedNote?: string
  /** Shown under the card when a tab is experimental; the layer's text when empty. */
  experimentalNote?: string
  /** Why a planned tab opens nothing; the layer's text when empty. */
  plannedReason?: string
}>()
const emit = defineEmits<{
  selectPlatform: [key: string]
  download: [row: DownloadRow, platform: string]
  copyDigest: [row: DownloadRow, platform: string]
}>()
defineSlots<{ unavailable?: () => unknown, actions?: () => unknown, foot?: () => unknown }>()

const t = useTranslate()
const locale = useLocale()
const config = useReleasesConfig()
const query = useDownloads()

const downloads = computed(() => query.data.value ?? null)
const pending = computed(() => query.asyncStatus.value === 'loading' && !query.data.value && !query.error.value)
const firstLoad = useDelayed(() => pending.value)

const { groups, detected, tab, current, live, pick } = useDownloadGroups(downloads, { releasesUrl: () => releasesUrl })

const allReleasesUrl = computed(() => releasesUrl ?? config.releasesUrl)
const changelogTo = computed(() => changelogPath ?? config.changelogPath)

const notes = computed(() => [
  ...(groups.value.some(g => g.planned) ? [plannedNote || t('release.plannedNote', '* No build yet.')] : []),
  ...(groups.value.some(g => g.experimental) ? [experimentalNote || t('release.experimentalNote', '** Experimental.')] : []),
])

const published = computed(() => formatReleaseDate(downloads.value?.published_at, locale.value))
const latestLabel = computed(() => t('release.latest', 'Latest'))
const allReleasesLabel = computed(() => t('release.allReleases', 'All releases'))
const changelogLabel = computed(() => t('release.changelog', 'Changelog'))
const emptyTitle = computed(() => t('release.noneTitle', 'No downloads yet'))
const emptyText = computed(() => t('release.noneText', 'Nothing has been published for this repository.'))

// No action without a URL to point to.
const emptyAction = computed(() => (allReleasesUrl.value ? allReleasesLabel.value : undefined))

function select(key: string) {
  pick(key)
  emit('selectPlatform', key)
}

function open(url: string) {
  if (url && inBrowser()) window.open(url, '_blank', 'noopener')
}
</script>
