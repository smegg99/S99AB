<!-- web/src/components/releases/UpdateBanner.vue -->
<template>
  <v-alert
    v-if="visible"
    :title="title"
    type="info"
    variant="tonal"
  >
    <div class="d-flex flex-wrap align-center ga-4">
      <span class="text-body-2">{{ body }}</span>

      <v-spacer />

      <div class="s99ab-controls">
        <slot name="actions">
          <v-btn
            v-if="latest?.html_url"
            :href="latest.html_url"
            color="accent"
            size="small"
            append-icon="mdi-open-in-new"
            target="_blank"
            rel="noopener"
          >
            {{ getLabel }}
          </v-btn>
        </slot>

        <v-btn
          v-if="dismissible"
          variant="text"
          size="small"
          @click="dismissed = true"
        >
          {{ laterLabel }}
        </v-btn>
      </div>
    </div>
  </v-alert>
</template>

<script setup lang="ts">
import { computed, ref } from 'vue'
import { useTranslate } from '../../composables/useTranslate'
import { useUpdateCheck } from '../../composables/releases/useUpdateCheck'

// Shown only when a newer release exists. A dev build reports no version and is
// never behind.
const { current, dismissible = true } = defineProps<{
  /** The running version. Defaults to what /version reports. */
  current?: string
  dismissible?: boolean
}>()
defineSlots<{ actions?: () => unknown }>()

const t = useTranslate()
const check = useUpdateCheck({ current: () => current })

const { behind, latest } = check
const dismissed = ref(false)

// Dismissal lasts until the next load.
const visible = computed(() => behind.value && !dismissed.value)

const title = computed(() => t('release.updateTitle', 'A newer version is available'))

// Both versions in one message, so the locale controls their order.
const body = computed(() => t(
  'release.updateBody',
  'You have {current}. The newest is {latest}.',
  { current: check.current.value, latest: check.latestVersion.value },
))
const getLabel = computed(() => t('release.getUpdate', 'Get it'))
const laterLabel = computed(() => t('release.later', 'Later'))
</script>
