<!-- web/src/components/releases/RepoStat.vue -->
<template>
  <a
    v-if="shown && stats"
    :href="stats.html_url"
    :aria-label="label"
    class="repo"
    target="_blank"
    rel="noopener"
  >
    <!-- Cells: the hairline pairs adjacent .repo__count elements, so added
         items get the same seam. -->
    <v-tooltip
      :text="title"
      activator="parent"
      location="bottom"
    />
    <slot name="prepend" />

    <v-icon
      class="repo__mark"
      icon="mdi-github"
    />
    <span class="repo__count">
      <v-icon icon="mdi-star-outline" />
      {{ count(stats.stars) }}
    </span>
    <span
      v-if="forks"
      class="repo__count"
    >
      <v-icon icon="mdi-source-fork" />
      {{ count(stats.forks) }}
    </span>

    <slot name="append" />
  </a>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { formatCount } from '../../composables/releases/internal/count'
import { useRepoStats } from '../../composables/releases/useReleases'
import { useLocale, useTranslate } from '../../composables/useTranslate'

// One bordered readout: mark and counts divided by hairlines. Renders nothing
// when the repository could not be read.
const { forks = true, minStars = 0, compact = true } = defineProps<{
  forks?: boolean
  /** Hides the readout until the repository has this many stars. */
  minStars?: number
  /** 1234 as 1.2K; the accessible name keeps the exact count. */
  compact?: boolean
}>()
defineSlots<{ prepend?: () => unknown, append?: () => unknown }>()

const t = useTranslate()
const query = useRepoStats()

const locale = useLocale()

const stats = computed(() => query.data.value ?? null)
const shown = computed(() => !!stats.value?.available && stats.value.stars >= minStars)

function count(value: number): string {
  return compact ? formatCount(value, locale.value) : String(value)
}
const title = computed(() => t('release.starOnGithub', 'GitHub'))

// An accessible name for the bare numbers. One message per shape, since Polish
// inflects the noun by count.
const label = computed(() => {
  const s = stats.value
  if (!s) return title.value

  if (!forks) {
    return t('release.starsLabel', 'GitHub: {stars} stars', { stars: s.stars })
  }
  return t('release.starsForksLabel', 'GitHub: {stars} stars, {forks} forks', {
    stars: s.stars,
    forks: s.forks,
  })
})
</script>

<style scoped>
/* One border across three cells, which v-chip and v-btn-group cannot do. */
.repo {
  display: inline-flex;
  flex: 0 0 auto;
  align-items: stretch;
  /* The shared control height. */
  min-height: var(--s99ab-control-h);
  border: 1px solid rgb(var(--v-theme-edge));
  border-radius: var(--s99ab-radius);
  background: rgb(var(--v-theme-raised));
  color: rgb(var(--v-theme-ink2));
  text-decoration: none;
}

.repo:hover {
  border-color: rgb(var(--v-theme-accent));
  color: rgb(var(--v-theme-ink));
}

.repo__mark,
.repo__count {
  display: inline-flex;
  align-items: center;
  /* A typographic gap between glyph and number. */
  gap: 4px;
  padding-inline: var(--s99ab-pad-tight);
}

/* The layer's glyph size. */
.repo__mark {
  font-size: var(--s99ab-icon);
}

/* The glyph scales with its number. */
.repo__count .v-icon {
  font-size: 1em;
}

/* Hairlines between readings. */
.repo__count + .repo__count,
.repo__mark + .repo__count {
  border-inline-start: 1px solid rgb(var(--v-theme-edge));
}

.repo__count {
  font-size: var(--s99ab-label-size);
  font-weight: 600;
  /* Live numbers keep a fixed width. */
  font-variant-numeric: tabular-nums;
}
</style>
