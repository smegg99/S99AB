<!-- web/src/components/shell/NavDrawer.vue -->
<template>
  <v-navigation-drawer
    v-model="model"
    :permanent="permanent"
    :temporary="!permanent"
    :width="drawn"
    class="nav s99ab-glass"
  >
    <div class="nav__scroll">
      <UiNavTrail
        v-if="variant === 'trail'"
        :groups="groups"
        :lit="lit"
        @navigate="close"
      />
      <UiNavList
        v-else
        :groups="groups"
        @navigate="close"
      />
    </div>

    <template
      v-if="$slots.append"
      #append
    >
      <div class="nav__foot">
        <slot name="append" />
      </div>
    </template>
  </v-navigation-drawer>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import UiNavList from './NavList.vue'
import UiNavTrail from './NavTrail.vue'
import { useCssNumber } from '../../composables/useCssNumber'
import type { NavGroup, NavLit, NavVariant } from '../../types'

// The drawer and its breakpoint; `variant` picks the body. `width` is a number
// because Vuetify reserves the page offset from it.
const {
  groups,
  permanent,
  variant = 'list',
  lit = 'both',
  width = 0,
} = defineProps<{
  groups: NavGroup[]
  /** Pinned open; the shell sets it from the breakpoint. */
  permanent?: boolean
  /** `trail` is the animated rail; see UiNavTrail. */
  variant?: NavVariant
  /** The current row's look on the trail. See NavLit. */
  lit?: NavLit
  /** 0 follows --s99ab-rail-w. */
  width?: number
}>()

const model = defineModel<boolean>({ default: false })

// Read live, so retuning --s99ab-rail-w also moves the layout offset.
const rail = useCssNumber('--s99ab-rail-w', 236)
const drawn = computed(() => width || rail.value)

// A temporary drawer closes after navigating.
function close() {
  if (!permanent) model.value = false
}
</script>

<style scoped>
/* Frosted by .s99ab-glass. Draws only its own edge; see AppBar. */
.nav {
  border-inline-end: 1px solid rgb(var(--v-theme-line));
}

/* Reads the knobs, which a pa-* utility would not follow. */
.nav__scroll {
  padding: var(--s99ab-nav-pad-block) var(--s99ab-nav-pad-inline);
}

/* The foot's inset and the hairline above it in one element. */
.nav__foot {
  padding: var(--s99ab-control-gap) var(--s99ab-pad-tight);
  border-top: 1px solid rgb(var(--v-theme-lineSoft));
}
</style>
