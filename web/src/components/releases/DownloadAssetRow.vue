<!-- web/src/components/releases/DownloadAssetRow.vue -->
<template>
  <!-- Not v-list-item, whose title/subtitle slots impose a type scale. -->
  <div
    :class="{ 's99ab-asset--primary': row.primary }"
    class="s99ab-asset"
  >
    <div class="s99ab-asset__text">
      <div class="d-flex align-baseline flex-wrap ga-2">
        <span class="font-weight-bold text-body-2">{{ row.label }}</span>
        <span
          v-if="row.sub"
          class="text-caption text-medium-emphasis"
        >{{ row.sub }}</span>

        <!-- Only when this platform's build is behind the newest release. -->
        <v-chip
          v-if="row.version"
          size="x-small"
          variant="tonal"
          color="warning"
          tabindex="0"
          :aria-label="olderTitle"
        >
          <v-tooltip
            :text="olderTitle"
            activator="parent"
            location="bottom"
          />
          {{ row.version }}
        </v-chip>
      </div>

      <span
        v-if="row.filename"
        class="text-caption text-medium-emphasis s99ab-asset__file"
      >{{ row.filename }}</span>

      <!-- GitHub reports no digest for source archives or older assets. -->
      <v-btn
        v-if="hex"
        :prepend-icon="copyIcon"
        :aria-label="copyTitle"
        :data-umami-event="umami ? 'copy-checksum' : undefined"
        :data-umami-event-os="umami ? platform : undefined"
        class="s99ab-asset__digest"
        variant="text"
        size="x-small"
        @click="copyDigest"
      >
        <v-tooltip
          :text="copyTitle"
          activator="parent"
          location="bottom"
        />
        {{ algo }} {{ short }}
      </v-btn>
      <span
        class="d-sr-only"
        aria-live="polite"
      >{{ copied ? copiedLabel : '' }}</span>
    </div>

    <span
      v-if="row.size"
      class="text-caption text-medium-emphasis d-none d-sm-block"
    >{{ row.size }}</span>

    <v-btn
      :color="downloadColor"
      :variant="downloadVariant"
      :href="row.url"
      :data-umami-event="umami ? 'download' : undefined"
      :data-umami-event-os="umami ? platform : undefined"
      :data-umami-event-format="umami ? row.kind : undefined"
      size="small"
      prepend-icon="mdi-download"
      target="_blank"
      rel="noopener"
      @click="emit('download')"
    >
      {{ downloadLabel }}
    </v-btn>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { useCopy } from '../../composables/useCopy'
import type { DownloadRow } from '../../composables/releases/useDownloadGroups'
import { useReleasesConfig } from '../../composables/releases/useReleases'
import { useTranslate } from '../../composables/useTranslate'

const { row, platform = '' } = defineProps<{
  row: DownloadRow
  /** The tab this row is in, for tracking. */
  platform?: string
}>()
const emit = defineEmits<{ download: [], copyDigest: [] }>()

const t = useTranslate()
const config = useReleasesConfig()
const { copied, copy } = useCopy()

const umami = computed(() => config.umami)
const downloadLabel = computed(() => t('release.download', 'Download'))
const downloadColor = computed(() => (row.primary ? 'accent' : undefined))
const downloadVariant = computed(() => (row.primary ? 'flat' : 'outlined'))

// The digest names its own algorithm.
const algo = computed(() => row.digest.split(':')[0] ?? '')
const hex = computed(() => row.digest.split(':')[1] ?? '')

// Both ends, for comparing with sha256sum output.
const short = computed(() =>
  hex.value.length > 20 ? `${hex.value.slice(0, 8)}...${hex.value.slice(-8)}` : hex.value,
)

const copyIcon = computed(() => (copied.value ? 'mdi-check' : 'mdi-content-copy'))
const copiedLabel = computed(() => t('release.copied', 'Copied'))
const copyTitle = computed(() =>
  copied.value ? copiedLabel.value : t('release.copyHash', 'Copy the {algo} checksum', { algo: algo.value }),
)
const olderTitle = computed(() =>
  t('release.olderBuild', 'This platform\'s newest build is {version}', { version: row.version }),
)

function copyDigest() {
  copy(hex.value)
  emit('copyDigest')
}
</script>
