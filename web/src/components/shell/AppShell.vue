<!-- web/src/components/shell/AppShell.vue -->
<template>
  <v-app class="shell">
    <UiBackdrop v-if="showBackdrop" />

    <!-- Over the backdrop, fading in once the shader runs; the washes remain the fallback. -->
    <UiFlow
      v-if="showFlow"
      ground
    />

    <UiAppBar
      :title="title"
      :subtitle="subtitle"
      :logo="logo"
      :groups="groups"
      :nav-toggle="showNavToggle"
      @toggle-nav="toggleNav"
    >
      <template
        v-if="$slots.brand"
        #brand
      >
        <slot name="brand" />
      </template>

      <template #nav>
        <slot name="bar-nav" />
      </template>

      <slot name="bar" />
    </UiAppBar>

    <UiNavDrawer
      v-if="hasNav"
      v-model="drawer"
      :groups="groups"
      :permanent="permanent"
      :variant="navVariant"
      :lit="navLit"
    >
      <template
        v-if="$slots['nav-append']"
        #append
      >
        <slot name="nav-append" />
      </template>
    </UiNavDrawer>

    <v-main class="shell__main">
      <v-container
        :class="pageClass"
        class="shell__page"
      >
        <slot />
      </v-container>

      <slot name="footer" />
    </v-main>
  </v-app>
</template>

<script setup lang="ts">
import type { NavGroup, NavLit, NavVariant } from '../../types'
import { computed } from 'vue'
import { useAppearance } from '../../composables/appearance/useAppearance'
import { useShellDrawer } from '../../composables/shell/useShellDrawer'
import UiAppBar from './AppBar.vue'
import { groundConfig } from '../../composables/appearance/useFlow'
import UiBackdrop from './Backdrop.vue'
import UiFlow from './Flow.vue'
import UiNavDrawer from './NavDrawer.vue'

// The whole application frame: ground, bar, rail, container width and panel gap.
// Components are imported explicitly so the layer typechecks on its own.
const {
  groups = [],
  navVariant = 'list',
  navLit = 'both',
  defer = false,
  backdrop = true,
  noFlow = false,
  stack = true,
  wide = false,
} = defineProps<{
  title?: string
  subtitle?: string
  /** URL of a one-colour mark, drawn in the accent before the title. */
  logo?: string
  /** Grouped nav links. None means no rail and no hamburger. */
  groups?: NavGroup[]
  /** The drawer body. `trail` is the animated rail; see UiNavTrail. */
  navVariant?: NavVariant
  /** The current row's look on the trail. See NavLit. */
  navLit?: NavLit
  /** The washed ground. Off for a screen that fills the window itself. */
  backdrop?: boolean
  /**
   * Suppresses the WebGL ground (`s99ab.ground`) for this shell. Negative,
   * because Vue casts an absent Boolean prop to false.
   */
  noFlow?: boolean
  /**
   * Skips style, layout and paint of off-screen panels, which cuts the cost of
   * an appearance change on long pages. Off by default: a skipped panel reports
   * its placeholder box to anything measuring it until it scrolls into view.
   */
  defer?: boolean
  /** Stacks the page's children with the standard gap. */
  stack?: boolean
  /** Drops the container's width cap. */
  wide?: boolean
}>()

const { hasNav, permanent, drawer, showNavToggle, toggleNav } = useShellDrawer(() => groups)

// Applies the stored or OS appearance from the first screen.
useAppearance()

// The config decides the ground; the shell can only veto it.
const showFlow = computed(() => !noFlow && groundConfig().kind === 'flow')
const showBackdrop = computed(() => backdrop && groundConfig().kind !== 'none')

const pageClass = computed(() => ({
  's99ab-wide': wide,
  'shell__page--stack': stack,
  'shell__page--defer': defer,
}))
</script>

<style scoped>
/* The window never scrolls; the content region does. The bar and rail stay put
   and the reserved gutter keeps every page the same width. */
.shell {
  height: 100dvh;
  overflow: hidden;
}

/* Above the backdrop at z-index 0. Vuetify layout items sit at 1004 and above. */
.shell__main {
  position: relative;
  z-index: 1;
  height: 100%;
  overflow-y: auto;
  scrollbar-gutter: stable;

  /* v-main's top padding (the bar) is inside the scroll box, so anchor and
     fragment scrolls would land under the bar. Includes the page's top space. */
  scroll-padding-top: calc(var(--v-layout-top, 0px) + var(--s99ab-page-y, 0px));
}

/* One vertical rhythm for every screen. The inline inset is a knob so
   .s99ab-sticky-top can cancel it. */
.shell__page {
  padding-block: var(--s99ab-page-y);
  padding-inline: var(--s99ab-pad);
}

/* Reads --s99ab-gap so a runtime retune applies. */
.shell__page--stack {
  display: flex;
  flex-direction: column;
  gap: var(--s99ab-gap);
}

/* Off-screen panels skip rendering; see the `defer` prop. `auto` makes the
   browser remember each panel's real height after the first render. */
.shell__page--defer > * {
  content-visibility: auto;
  contain-intrinsic-size: auto var(--s99ab-page-defer-size);
}
</style>
