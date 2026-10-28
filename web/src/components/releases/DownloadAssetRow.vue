<!-- web/src/components/releases/DownloadAssetRow.vue -->
<template>
  <!-- Not v-list-item, whose title/subtitle slots impose a type scale. -->
  <div
    :class="{ 's99ab-asset--primary': primary }"
    class="s99ab-asset"
  >
    <div class="s99ab-asset__text">
      <div class="d-flex align-baseline flex-wrap ga-2">
        <span class="font-weight-bold text-body-2">{{ label }}</span>
        <span
          v-if="asset.arch"
          class="text-caption text-medium-emphasis"
        >{{ asset.arch }}</span>

        <!-- Only when this platform's build is behind the newest release. -->
        <v-chip
          v-if="version"
          :title="olderTitle"
          size="x-small"
          variant="tonal"
          color="warning"
        >
          {{ version }}
        </v-chip>
      </div>

      <span class="text-caption text-medium-emphasis s99ab-asset__file">{{ asset.name }}</span>

      <!-- GitHub reports no digest for source archives or older assets. -->
      <v-btn
        v-if="hex"
        :prepend-icon="copyIcon"
        :title="copyTitle"
        :aria-label="copyTitle"
        class="s99ab-asset__digest"
        variant="text"
        size="x-small"
        @click="copy(hex)"
      >
        {{ algo }} {{ short }}
      </v-btn>
    </div>

    <span
      v-if="size"
      class="text-caption text-medium-emphasis d-none d-sm-block"
    >{{ size }}</span>

    <v-btn
      :color="downloadColor"
      :variant="downloadVariant"
      :href="asset.download_url"
      size="small"
      prepend-icon="mdi-download"
      target="_blank"
      rel="noopener"
    >
      {{ downloadLabel }}
    </v-btn>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { useCopy } from '../../composables/useCopy'
import type { ReleaseAsset } from '../../composables/releases/useReleases'
import { formatBytes, kindKey } from '../../composables/releases/internal/api'
import { useTranslate } from '../../composables/useTranslate'

const { asset, primary, version = '' } = defineProps<{
  asset: ReleaseAsset
  /** The platform's default format, offered first. */
  primary?: boolean
  /** Set only when this build is older than the newest release. */
  version?: string
}>()

const t = useTranslate()
const { copied, copy } = useCopy()

// An unknown kind falls back to its raw value.
const label = computed(() => t(`release.kinds.${kindKey(asset.kind)}`, asset.kind))
const size = computed(() => formatBytes(asset.size))
const downloadLabel = computed(() => t('release.download', 'Download'))
const downloadColor = computed(() => (primary ? 'accent' : undefined))
const downloadVariant = computed(() => (primary ? 'flat' : 'outlined'))

// The digest names its own algorithm.
const algo = computed(() => asset.digest.split(':')[0] ?? '')
const hex = computed(() => asset.digest.split(':')[1] ?? '')

// Both ends, for comparing with sha256sum output.
const short = computed(() =>
  hex.value.length > 20 ? `${hex.value.slice(0, 8)}...${hex.value.slice(-8)}` : hex.value,
)

const copyIcon = computed(() => (copied.value ? 'mdi-check' : 'mdi-content-copy'))
const copyTitle = computed(() =>
  copied.value ? t('release.copied', 'Copied') : t('release.copyHash', 'Copy checksum'),
)
const olderTitle = computed(() => t('release.olderBuild', 'This build is older than the newest release.'))
</script>
