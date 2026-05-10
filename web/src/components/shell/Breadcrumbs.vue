<!-- web/src/components/shell/Breadcrumbs.vue -->
<template>
  <nav
    v-if="trail.length"
    class="crumbs"
    :aria-label="label"
  >
    <template
      v-for="(crumb, i) in trail"
      :key="i"
    >
      <v-icon
        v-if="i > 0"
        class="crumbs__sep"
        icon="mdi-chevron-right"
        aria-hidden="true"
      />
      <span
        class="crumbs__step"
        :class="{ 'crumbs__step--current': i === trail.length - 1 }"
      >{{ crumb.label }}</span>
    </template>
  </nav>
</template>

<script setup lang="ts">
import type { NavGroup } from '../../types'
import { computed } from 'vue'
import { useBreadcrumbs } from '../../composables/shell/useBreadcrumbs'
import { useTranslate } from '../../composables/useTranslate'

// The group and page the route is on, built from the same nav groups as the rail.
const { groups = [] } = defineProps<{ groups?: NavGroup[] }>()

const t = useTranslate()
const label = computed(() => t('common.location', 'Location'))
const { trail } = useBreadcrumbs(() => groups)
</script>

<style scoped>
/* Layout only. The gap and glyph size are fixed: no token covers a crumb's
   inner spacing, which is tighter than --s99ab-control-gap. */
.crumbs {
  display: flex;
  align-items: center;
  gap: 8px;
  /* Inset from the brand mark. */
  margin-inline-start: var(--s99ab-bar-crumb-inset, 14px);
  min-width: 0;
  overflow: hidden;
}

.crumbs__step {
  color: rgb(var(--v-theme-ink3));
  font-size: var(--s99ab-bar-crumb-size, 0.9rem);
  letter-spacing: 0.03em;
  white-space: nowrap;
}

/* The current page outranks its section. */
.crumbs__step--current {
  color: rgb(var(--v-theme-ink));
  font-weight: 600;
}

.crumbs__sep {
  color: rgb(var(--v-theme-ink3));
  font-size: 15px;
  opacity: 0.7;
}
</style>
