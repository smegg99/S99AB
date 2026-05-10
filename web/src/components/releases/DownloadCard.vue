<!-- web/src/components/releases/DownloadCard.vue -->
<template>
  <v-card>
    <UiLoadingState
      v-if="firstLoad"
      :rows="3"
      variant="skeleton"
      lines="one"
    />

    <!-- Unavailable (nothing published, or GitHub unreachable) points to the
         repository's releases page. -->
    <slot
      v-else-if="!downloads?.available"
      name="unavailable"
    >
      <UiEmptyState
        :title="emptyTitle"
        :text="emptyText"
        :action-label="emptyAction"
        icon="mdi-package-variant"
        @action="open(releasesUrl)"
      />
    </slot>

    <template v-else>
      <div class="s99ab-downloads__head s99ab-controls">
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
          class="text-caption text-medium-emphasis"
        >{{ published }}</time>
        <v-spacer />
        <slot name="actions" />
      </div>

      <!-- The strip height, so the tabs and the version strip match. -->
      <v-tabs
        v-model="tab"
        :height="stripHeight"
        color="accent"
        class="s99ab-downloads__tabs"
      >
        <v-tab
          v-for="group in groups"
          :key="group.key"
          :value="group.key"
          :prepend-icon="group.icon"
        >
          {{ group.name }}
          <!-- The detected system, as a label. -->
          <v-chip
            v-if="group.key === detected"
            class="ms-2 s99ab-downloads__sys"
            size="x-small"
            variant="flat"
            color="accent"
          >
            {{ yoursLabel }}
          </v-chip>
        </v-tab>
      </v-tabs>

      <div
        v-if="current"
        class="s99ab-downloads__rows"
      >
        <UiDownloadAssetRow
          v-for="asset in current.assets"
          :key="asset.name"
          :asset="asset"
          :primary="asset.kind === current.primaryKind"
          :version="current.version"
        />
      </div>
    </template>
  </v-card>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import UiEmptyState from '../state/EmptyState.vue'
import UiLoadingState from '../state/LoadingState.vue'
import UiDownloadAssetRow from './DownloadAssetRow.vue'
import { useDelayed } from '../../composables/useDelay'
import { useDownloadGroups } from '../../composables/releases/useDownloadGroups'
import { formatReleaseDate } from '../../composables/releases/useReleaseDate'
import { useDownloads } from '../../composables/releases/useReleases'
import { useTranslate } from '../../composables/useTranslate'
import { useCssNumber } from '../../composables/useCssNumber'

// The newest version, a tab per platform with the user's marked, and every
// format that platform ships.
const { releasesUrl = '' } = defineProps<{
  /** Where "all releases" points when there is nothing to show. */
  releasesUrl?: string
}>()

const t = useTranslate()
const query = useDownloads()

// The knob read live.
const stripHeight = useCssNumber('--s99ab-strip-h', 44)

const downloads = computed(() => query.data.value ?? null)
const firstLoad = useDelayed(() => query.asyncStatus.value === 'loading' && !query.data.value)

const { groups, detected, tab, current } = useDownloadGroups(downloads)

const published = computed(() => formatReleaseDate(downloads.value?.published_at))
const latestLabel = computed(() => t('release.latest', 'Latest'))
const yoursLabel = computed(() => t('release.yourSystem', 'Your system'))
const allReleasesLabel = computed(() => t('release.allReleases', 'All releases'))
const emptyTitle = computed(() => t('release.noneTitle', 'No downloads yet'))
const emptyText = computed(() => t('release.noneText', 'Nothing has been published for this repository.'))

// No action without a URL to point to.
const emptyAction = computed(() => (releasesUrl ? allReleasesLabel.value : undefined))

function open(url: string) {
  if (url && typeof window !== 'undefined') window.open(url, '_blank', 'noopener')
}
</script>
