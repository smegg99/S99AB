<!-- web/src/components/auth/AuthPage.vue -->
<template>
  <div class="s99ab-auth">
    <!-- The same ground as the rest of the app. Opt-out, like the shell's. -->
    <UiBackdrop v-if="showBackdrop" />
    <UiFlow
      v-if="showFlow"
      ground
    />

    <!-- The way back, opposite the controls. Omitted when no homePath is configured. -->
    <div
      v-if="hasHome"
      class="s99ab-auth__out s99ab-controls"
    >
      <slot name="home">
        <v-btn
          :to="paths.homePath"
          :prepend-icon="homeIcon"
          variant="text"
          size="small"
        >
          {{ homeText }}
        </v-btn>
      </slot>
    </div>

    <!-- Pinned to the viewport, so the card needs no room for the buttons. -->
    <div
      v-if="hasControls"
      class="s99ab-auth__controls s99ab-controls"
    >
      <slot name="controls">
        <UiThemeToggle
          v-if="theme"
          :storage-key="storageKey"
        />
        <UiContrastToggle
          v-if="contrast"
          :storage-key="storageKey"
        />
      </slot>
    </div>

    <!-- The mark, above and outside the card. Its own element, so #brand replaces only the mark. -->
    <div
      v-if="hasBrand"
      class="s99ab-auth__mark"
    >
      <slot name="brand">
        <UiBrandMark />
      </slot>
    </div>

    <UiAuthCard
      :kind="flowKind"
      :return-to="target"
      :app-name="title"
      :icon="icon"
      :subtitle="subtitle"
      :version="version"
      :commit="commit"
      :built-at="builtAt"
      :repo="repo"
      @run="emit('run', $event)"
      @unsupported="emit('unsupported', $event)"
    >
      <!-- Only the slots this page received, so the card's `$slots.plate`
           checks stay accurate. -->
      <template
        v-for="name in forwarded"
        :key="name"
        #[name]
      >
        <slot :name="name" />
      </template>

      <!-- Instantiated only when asked, since it fetches and needs Pinia. -->
      <template
        v-if="build && !slots.plate"
        #plate
      >
        <UiAuthBuild />
      </template>
    </UiAuthCard>
  </div>
</template>

<script setup lang="ts">
import { computed, useSlots } from 'vue'
import UiAuthBuild from './AuthBuild.vue'
import UiAuthCard from './AuthCard.vue'
import UiBackdrop from '../shell/Backdrop.vue'
import UiBrandMark from './BrandMark.vue'
import UiFlow from '../shell/Flow.vue'
import UiContrastToggle from '../shell/ContrastToggle.vue'
import UiThemeToggle from '../shell/ThemeToggle.vue'
import { useAppearance } from '../../composables/appearance/useAppearance'
import { groundConfig } from '../../composables/appearance/internal/flow'
import { useAuthFlowKind, useReturnTo } from '../../composables/kratos/internal/route'
import { useAuthPaths } from '../../composables/kratos/useAuthPaths'
import { useTranslate } from '../../composables/useTranslate'
import type { KratosFlowKind, KratosNode } from '../../composables/kratos/useKratosFlow'
import { useForwardedSlots } from '../../composables/primitives/internal/slots'

/**
 * The signed-out screen, with no app frame (give it an empty layout). The mark
 * and card are centred; the way back and the appearance controls are pinned to
 * the corners. Kind and return URL come from the route by default.
 */
const {
  kind,
  returnTo = '',
  title = '',
  subtitle,
  icon = '',
  build,
  version = '',
  commit = '',
  builtAt = '',
  brand = true,
  home = true,
  homeLabel = '',
  homeIcon = 'mdi-chevron-left',
  theme = true,
  contrast = true,
  storageKey = '',
  repo,
  backdrop = true,
  noFlow,
} = defineProps<{
  /** Overrides the `[flow]` route segment, for a page at a fixed path. */
  kind?: KratosFlowKind
  /** Overrides `?return_to=`, which is resolved against this origin. */
  returnTo?: string
  /** The app's name, for the card's head strip. */
  title?: string
  subtitle?: string
  icon?: string
  /**
   * Fills the plate from /version (apihealth). Needs Colada. The props below
   * fill it by hand instead.
   */
  build?: boolean
  /** Empty in a dev build. */
  version?: string
  commit?: string
  builtAt?: string
  /** Draws the mark above the card. */
  brand?: boolean
  /**
   * Draws the way back when s99ab.auth.homePath is set. Off for a screen
   * reached from an email link.
   */
  home?: boolean
  /** Overrides "Back". */
  homeLabel?: string
  /** The glyph before it. Empty for a label alone. */
  homeIcon?: string
  /** The light/dark button in the corner. */
  theme?: boolean
  /** The contrast button beside it. */
  contrast?: boolean
  /**
   * Overrides `s99ab.appearance.storageKey` for this screen. A second key makes
   * the preference appear to reset on sign-out.
   */
  storageKey?: string
  /** Draws the repository readout at the plate's trailing edge. Needs Colada. */
  repo?: boolean
  /** The washed ground. Off for a screen that brings its own. */
  backdrop?: boolean
  /** Suppresses the WebGL ground for this screen. Negative, as in UiAppShell. */
  noFlow?: boolean
}>()

const emit = defineEmits<{
  run: [node: KratosNode]
  unsupported: [node: KratosNode]
}>()

// Every slot the card offers except its body.
const FORWARDED = [
  'prepend',
  'append',
  'form-prepend',
  'form-append',
  'plate',
  'plate-end',
  'footer',
] as const

// The config decides whether there is a shader; this screen can only veto it.
const showFlow = computed(() => !noFlow && groundConfig().kind === 'flow')
const showBackdrop = computed(() => backdrop && groundConfig().kind !== 'none')

const paths = useAuthPaths()
const t = useTranslate()
const slots = useSlots()

// Applies the stored appearance, since this screen has no app bar to do it.
useAppearance(() => ({ theme: storageKey }))

const routeKind = useAuthFlowKind()
const routeReturnTo = useReturnTo()

const flowKind = computed(() => kind ?? routeKind.value)
const target = computed(() => returnTo || routeReturnTo.value)

const forwarded = useForwardedSlots({ only: FORWARDED })

const hasBrand = computed(() => brand || Boolean(slots.brand))

// A slot counts as a way back even with no path configured.
const hasHome = computed(() => Boolean(slots.home) || (home && Boolean(paths.homePath)))

const homeText = computed(() => homeLabel || t('auth.backHome', 'Back'))

const hasControls = computed(() => theme || contrast || Boolean(slots.controls))
</script>
