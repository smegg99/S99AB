<!-- web/src/components/releases/ReleaseNotice.vue -->
<template>
  <v-card
    :color="tone"
    :style="{ '--s99ab-notice': `var(--v-theme-${tone})` }"
    tag="aside"
    role="note"
    variant="tonal"
    class="notice d-flex align-start ga-4 pa-5"
  >
    <v-icon :icon="`$${tone}`" />
    <div class="notice__body">
      <p class="text-title-medium font-weight-bold mt-0 mb-2">
        {{ heading }}
      </p>
      <!-- The app's paragraphs; text is the one-paragraph shorthand. -->
      <slot>
        <p
          v-if="text"
          class="text-body-medium mt-0 mb-3"
        >
          {{ text }}
        </p>
      </slot>
      <v-btn
        v-if="linkTo || linkHref"
        :to="linkTo || undefined"
        :href="linkHref || undefined"
        :target="linkHref ? '_blank' : undefined"
        :rel="linkHref ? 'noopener' : undefined"
        class="px-0"
        variant="text"
        size="small"
      >
        {{ linkText }}
      </v-btn>
    </div>
  </v-card>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { useTranslate } from '../../composables/useTranslate'

// A striped notice above a download card or changelog, such as a beta warning with a feedback link.
const { title = '', text = '', linkTo = '', linkHref = '', linkLabel = '', tone = 'warning' } = defineProps<{
  title?: string
  text?: string
  /** An app route for the link. */
  linkTo?: string
  /** An external URL for the link, opened in a new tab. */
  linkHref?: string
  linkLabel?: string
  tone?: 'warning' | 'info'
}>()
defineSlots<{ default?: () => unknown }>()

const t = useTranslate()
const heading = computed(() => title || t('release.beta', 'Beta'))
const linkText = computed(() => linkLabel || t('release.feedback', 'Share feedback or report a problem'))
</script>

<style scoped>
.notice__body {
  min-width: 0;
}

.notice {
  overflow: hidden;
  border: 1px solid rgb(var(--v-theme-edge));
  border-radius: var(--s99ab-radius);
  background-image: repeating-linear-gradient(-45deg,
      color-mix(in srgb, rgb(var(--s99ab-notice)) 12%, transparent) 0 8px,
      transparent 8px 16px);
}
</style>
