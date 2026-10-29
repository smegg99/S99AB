<!-- web/src/components/releases/Changelog.vue -->
<template>
  <!-- Animates the height as entries arrive or change with the language. -->
  <UiAutoHeight>
    <!-- The page's own content above the list, in every state. -->
    <slot name="head" />

    <UiLoadingState
      v-if="firstLoad"
      :rows="3"
      variant="skeleton"
    />

    <div v-else-if="error">
      <UiErrorState
        :error="error"
        :title="failedTitle"
        :retrying="retrying"
        @retry="query.refetch()"
      />
      <div
        v-if="allReleasesUrl"
        class="d-flex justify-center"
      >
        <v-btn
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

    <UiEmptyState
      v-else-if="!releases.length"
      :title="emptyTitle"
      :action-label="allReleasesUrl ? allReleasesLabel : undefined"
      icon="mdi-history"
      @action="open(allReleasesUrl)"
    />

    <template v-else>
      <!-- A real heading and article per release, for screen reader navigation. -->
      <article
        v-for="release in releases"
        :key="release.version"
        class="s99ab-changelog__entry"
      >
        <header class="s99ab-changelog__head">
          <component
            :is="heading"
            class="s99ab-changelog__version"
          >
            {{ release.version }}
          </component>
          <time
            v-if="release.published_at"
            :datetime="release.published_at"
            class="s99ab-eyebrow"
          >{{ formatReleaseDate(release.published_at, locale) }}</time>
          <v-spacer />
          <!-- Quiet link out to the release. -->
          <v-btn
            :aria-label="onGithubLabel"
            :href="release.html_url"
            :data-umami-event="config.umami ? 'release-on-github' : undefined"
            :data-umami-event-version="config.umami ? release.version : undefined"
            icon
            variant="text"
            size="small"
            target="_blank"
            rel="noopener"
          >
            <v-tooltip
              :text="onGithubLabel"
              activator="parent"
              location="bottom"
            />
            <v-icon icon="mdi-open-in-new" />
          </v-btn>
        </header>

        <UiReleaseNotes
          :notes="release.notes"
          :notes-locale="release.notes_locale"
        />
        <slot
          name="entry-foot"
          :release="release"
        />
      </article>
    </template>
  </UiAutoHeight>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import UiAutoHeight from '../motion/AutoHeight.vue'
import UiEmptyState from '../state/EmptyState.vue'
import UiErrorState from '../state/ErrorState.vue'
import UiLoadingState from '../state/LoadingState.vue'
import UiReleaseNotes from './ReleaseNotes.vue'
import { useDelayed } from '../../composables/useDelay'
import { formatReleaseDate } from '../../composables/releases/internal/date'
import { type Release, useChangelog, useReleasesConfig } from '../../composables/releases/useReleases'
import { useLocale, useTranslate } from '../../composables/useTranslate'
import { inBrowser } from '../../browser/env'

const { headingLevel = 2, releasesUrl } = defineProps<{
  /** Each release's heading; 2 for a page whose title is the h1. */
  headingLevel?: 2 | 3 | 4
  /** Where the empty state points; overrides s99ab.releases.releasesUrl. */
  releasesUrl?: string
}>()
defineSlots<{ 'head'?: () => unknown, 'entry-foot'?: (props: { release: Release }) => unknown }>()

const t = useTranslate()
const locale = useLocale()
const config = useReleasesConfig()
const query = useChangelog()

const releases = computed(() => query.data.value ?? [])
const heading = computed(() => `h${headingLevel}`)
const allReleasesUrl = computed(() => releasesUrl ?? config.releasesUrl)
const error = query.error
const firstLoad = useDelayed(() => query.asyncStatus.value === 'loading' && !query.data.value)

// The error card owns no request, so the caller reports the retry for the spinner.
const retrying = computed(() => query.asyncStatus.value === 'loading')

const onGithubLabel = computed(() => t('release.onGithub', 'View on GitHub'))
// Its own key; the download card's noneTitle is about files.
const emptyTitle = computed(() => t('release.noHistory', 'No release has been published yet.'))
const failedTitle = computed(() => t('release.failed', 'The releases could not be loaded.'))
const allReleasesLabel = computed(() => t('release.allReleases', 'All releases'))

function open(url: string) {
  if (url && inBrowser()) window.open(url, '_blank', 'noopener')
}
</script>
