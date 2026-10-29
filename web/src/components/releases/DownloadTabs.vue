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
    <template
      v-for="group in groups"
      :key="group.key"
    >
      <!-- A platform with no build yet: disabled, with the reason on focus and hover. -->
      <UiDisabledHint
        v-if="group.planned"
        :reason="plannedReason || plannedDefault"
      >
        <v-tab
          :value="group.key"
          :prepend-icon="group.icon"
          disabled
        >
          {{ group.name }}*
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
      </UiDisabledHint>
      <v-tab
        v-else
        :value="group.key"
        :prepend-icon="group.icon"
        :data-umami-event="umami ? 'download-tab' : undefined"
        :data-umami-event-os="umami ? group.key : undefined"
      >
        {{ group.name }}{{ group.experimental ? '**' : '' }}
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
    </template>
  </v-tabs>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import UiDisabledHint from '../primitives/DisabledHint.vue'
import type { DownloadGroup } from '../../composables/releases/useDownloadGroups'
import { useReleasesConfig } from '../../composables/releases/useReleases'
import { useCssNumber } from '../../composables/useCssNumber'
import { useTranslate } from '../../composables/useTranslate'

// One tab per platform: * marks a planned one, ** an experimental one.
const { groups, detected = '', modelValue = '', plannedReason = '' } = defineProps<{
  groups: DownloadGroup[]
  detected?: string
  modelValue?: string
  /** Why a planned tab is disabled; the layer's text when empty. */
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

function select(key: unknown) {
  if (typeof key === 'string' && key) emit('select', key)
}
</script>
