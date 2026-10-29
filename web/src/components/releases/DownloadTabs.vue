<!-- web/src/components/releases/DownloadTabs.vue -->
<template>
  <!-- The strip height, so the tabs and the version strip match. -->
  <v-tabs
    :model-value="modelValue"
    :height="stripHeight"
    color="accent"
    class="s99ab-downloads__tabs"
    @update:model-value="select"
  >
    <!-- A planned tab stays focusable with aria-disabled, so it can say why it opens nothing. -->
    <v-tab
      v-for="group in groups"
      :key="group.key"
      :value="group.key"
      :prepend-icon="group.icon"
      :aria-disabled="group.planned ? 'true' : undefined"
      :class="{ 's99ab-downloads__planned': group.planned }"
      :data-umami-event="umami && !group.planned ? 'download-tab' : undefined"
      :data-umami-event-os="umami && !group.planned ? group.key : undefined"
    >
      <v-tooltip
        v-if="group.planned"
        :text="plannedReason || plannedDefault"
        activator="parent"
        location="bottom"
        :open-on-focus="true"
      />
      {{ group.name }}<span
        v-if="group.planned || group.experimental"
        class="s99ab-downloads__mark"
        aria-hidden="true"
      >{{ group.planned ? '*' : '**' }}</span>
      <span
        v-if="group.planned || group.experimental"
        class="d-sr-only"
      >{{ group.planned ? plannedMark : experimentalMark }}</span>
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
</template>

<script setup lang="ts">
import { computed } from 'vue'
import type { DownloadGroup } from '../../composables/releases/useDownloadGroups'
import { useReleasesConfig } from '../../composables/releases/useReleases'
import { useCssNumber } from '../../composables/useCssNumber'
import { useTranslate } from '../../composables/useTranslate'

// One tab per platform: * marks a planned one, ** an experimental one.
const { groups, detected = '', modelValue = '', plannedReason = '' } = defineProps<{
  groups: DownloadGroup[]
  detected?: string
  modelValue?: string
  /** Why a planned tab opens nothing; the layer's text when empty. */
  plannedReason?: string
}>()
const emit = defineEmits<{ select: [key: string] }>()

const t = useTranslate()
const config = useReleasesConfig()

// The knob read live.
const stripHeight = useCssNumber('--s99ab-strip-h', 44)
const umami = computed(() => config.umami)
const yoursLabel = computed(() => t('release.yourSystem', 'Your system'))
const plannedDefault = computed(() => t('release.plannedReason', 'No build for this platform yet.'))
const plannedMark = computed(() => t('release.plannedMark', '(no build yet)'))
const experimentalMark = computed(() => t('release.experimentalMark', '(experimental)'))

// A planned tab is refused here as well as by pick, so a click on it changes nothing.
function select(key: unknown) {
  if (typeof key !== 'string' || !key) return
  if (groups.some(g => g.key === key && g.planned)) return
  emit('select', key)
}
</script>

<style scoped>
/* The look of a disabled tab, without disabling the element that explains it. */
.s99ab-downloads__planned {
  opacity: var(--v-disabled-opacity);
}
</style>
