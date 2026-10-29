<!-- web/src/components/releases/DownloadDialog.vue -->
<template>
  <v-card>
    <v-card-title class="s99ab-controls">
      {{ heading }}
      <v-spacer />
      <v-btn
        :aria-label="closeLabel"
        icon
        variant="text"
        size="small"
        @click="close()"
      >
        <v-icon icon="mdi-close" />
      </v-btn>
    </v-card-title>

    <v-card-text class="pa-0">
      <!-- The same card the page embeds. -->
      <UiDownloadCard
        :releases-url="releasesUrl"
        :changelog-path="changelogPath"
      />
    </v-card-text>
  </v-card>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import UiDownloadCard from './DownloadCard.vue'
import { useDialog } from '../../composables/useDialog'
import { useTranslate } from '../../composables/useTranslate'

const { title = '', releasesUrl, changelogPath } = defineProps<{
  title?: string
  /** Overrides s99ab.releases.releasesUrl. */
  releasesUrl?: string
  /** Overrides s99ab.releases.changelogPath. */
  changelogPath?: string
}>()

const { close } = useDialog()
const t = useTranslate()

const heading = computed(() => title || t('release.downloads', 'Downloads'))
const closeLabel = computed(() => t('common.close', 'Close'))
</script>
