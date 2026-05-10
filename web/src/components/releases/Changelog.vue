<!-- web/src/components/releases/Changelog.vue -->
<template>
  <!-- Animates the height as entries arrive or change with the language. -->
  <UiAutoHeight>
    <UiLoadingState
      v-if="firstLoad"
      :rows="3"
      variant="skeleton"
    />

    <UiErrorState
      v-else-if="error"
      :error="error"
      :retrying="retrying"
      @retry="query.refetch()"
    />

    <UiEmptyState
      v-else-if="!releases.length"
      :title="emptyTitle"
      icon="mdi-history"
    />

    <template v-else>
      <!-- A real heading and article per release, for screen reader navigation. -->
      <article
        v-for="release in releases"
        :key="release.version"
        class="s99ab-changelog__entry"
      >
        <header class="s99ab-changelog__head">
          <h2 class="s99ab-changelog__version">
            {{ release.version }}
          </h2>
          <time
            v-if="release.published_at"
            :datetime="release.published_at"
            class="s99ab-eyebrow"
          >{{ formatReleaseDate(release.published_at) }}</time>
          <v-spacer />
          <!-- Quiet link out to the release. -->
          <v-btn
            :aria-label="onGithubLabel"
            :href="release.html_url"
            :title="onGithubLabel"
            icon
            variant="text"
            size="small"
            target="_blank"
            rel="noopener"
          >
            <v-icon icon="mdi-open-in-new" />
          </v-btn>
        </header>

        <UiReleaseNotes
          :notes="release.notes"
          :notes-locale="release.notes_locale"
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
import { formatReleaseDate } from '../../composables/releases/useReleaseDate'
import { useChangelog } from '../../composables/releases/useReleases'
import { useTranslate } from '../../composables/useTranslate'

const t = useTranslate()
const query = useChangelog()

const releases = query.releases
const error = query.error
const firstLoad = useDelayed(() => query.asyncStatus.value === 'loading' && !query.data.value)

// The error card owns no request, so the caller reports the retry for the spinner.
const retrying = computed(() => query.asyncStatus.value === 'loading')

const onGithubLabel = computed(() => t('release.onGithub', 'On GitHub'))
// Its own key; the download card's noneTitle is about files.
const emptyTitle = computed(() => t('release.noHistory', 'No releases yet'))
</script>
