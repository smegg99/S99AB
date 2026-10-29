<!-- web/src/components/shell/AppBar.vue -->
<template>
  <v-app-bar
    :height="height"
    class="bar s99ab-glass"
  >
    <v-app-bar-nav-icon
      v-if="navToggle"
      :aria-label="menuLabel"
      class="bar__burger"
      variant="text"
      size="small"
      @click="emit('toggleNav')"
    />

    <div class="bar__brand">
      <slot name="brand">
        <!-- The logo URL masks the accent, so a one-colour mark follows the theme.
             aria-hidden: the title is the accessible name. -->
        <span
          v-if="logo"
          class="bar__logo"
          :style="{ '--s99ab-bar-logo': `url('${logo}')` }"
          aria-hidden="true"
        />
        <span
          v-if="title"
          class="bar__title"
        >{{ title }}</span>
        <span
          v-if="subtitle"
          class="s99ab-eyebrow bar__sub"
        >{{ subtitle }}</span>
      </slot>
    </div>

    <div class="bar__mid">
      <UiBreadcrumbs :groups="groups" />
      <slot name="nav" />
    </div>

    <div class="bar__controls s99ab-controls">
      <slot />
    </div>
  </v-app-bar>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import UiBreadcrumbs from './Breadcrumbs.vue'
import { useTranslate } from '../../composables/useTranslate'
import { useCssNumber } from '../../composables/useCssNumber'
import type { NavGroup } from '../../types'

// The app's fixed top strip, frosted so the backdrop shows through.
defineProps<{
  title?: string
  /** A quieter word beside the title, such as an environment or workspace. */
  subtitle?: string
  /** Shows the hamburger; the shell passes it only when the nav is hidden. */
  navToggle?: boolean
  /** Nav groups, for the active route's breadcrumbs. */
  groups?: NavGroup[]
  /** URL of a one-colour mark, drawn in the accent before the title. */
  logo?: string
}>()
const emit = defineEmits<{ toggleNav: [] }>()

defineSlots<{ brand?: () => unknown, nav?: () => unknown, default?: () => unknown }>()

const t = useTranslate()

// Read live from --s99ab-bar-h, because Vuetify reserves v-main's offset from
// this number. The literal is the fallback before the document can be read.
const height = useCssNumber('--s99ab-bar-h', 54)

const menuLabel = computed(() => t('common.menu', 'Menu'))
</script>

<style scoped>
/* Ground and blur come from .s99ab-glass. The bottom edge is drawn here, since
   the `border` prop uses currentColor. */
.bar {
  border-bottom: 1px solid rgb(var(--v-theme-line));
}

/* Replaces Vuetify's 64px-bar padding with the knobs. */
.bar :deep(.v-toolbar__content) {
  gap: var(--s99ab-control-gap);
  /* Tighter than a panel strip, keeping the brand near the window corner. */
  padding-inline: var(--s99ab-control-gap);
}

/* The strip's three flex rows. min-width: 0 lets a long title truncate. */
.bar__brand {
  display: flex;
  flex: 0 0 auto;
  align-items: baseline;
  gap: var(--s99ab-control-gap);
  min-width: 0;
}

/* Takes the slack so the controls sit at the trailing edge without a v-spacer,
   whose styles load later. The 2px gap joins adjacent nav buttons. */
.bar__mid {
  display: flex;
  flex: 1 1 auto;
  align-items: center;
  gap: 2px;
  min-width: 0;
  overflow: hidden;
}

/* Layout only; heights, squares and gap come from .s99ab-controls. */
.bar__controls {
  flex: 0 0 auto;
}

.bar__burger {
  flex: 0 0 auto;
}

/* Outside .s99ab-controls, so the row's glyph size is set here. */
.bar__burger :deep(.v-icon) {
  font-size: var(--s99ab-icon);
}

/* The mask-drawn mark, centred on the row and sized by its own knob. */
.bar__logo {
  flex: 0 0 auto;
  align-self: center;
  width: var(--s99ab-bar-logo-size, 1.5rem);
  height: var(--s99ab-bar-logo-size, 1.5rem);
  background: rgb(var(--v-theme-accent));
  mask: var(--s99ab-bar-logo) center / contain no-repeat;
  -webkit-mask: var(--s99ab-bar-logo) center / contain no-repeat;
}

/* Between body size and h4; the app name is not a page heading. */
.bar__title {
  color: rgb(var(--v-theme-ink));
  font-size: var(--s99ab-bar-title-size);
  font-weight: 700;
  letter-spacing: -0.01em;
  white-space: nowrap;
}

/* Type from .s99ab-eyebrow; it must not wrap beside the title. */
.bar__sub {
  white-space: nowrap;
}
</style>
