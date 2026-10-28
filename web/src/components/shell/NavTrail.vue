<!-- web/src/components/shell/NavTrail.vue -->
<template>
  <div
    :class="`trail--lit-${lit}`"
    class="trail"
  >
    <!-- Hidden from assistive tech; the list items carry the destinations. -->
    <svg
      class="trail__rail"
      :width="trail.width.value"
      :height="trail.box.value.height"
      :viewBox="trail.box.value.viewBox"
      :style="{ 'inset-block-start': `${trail.box.value.top}px` }"
      aria-hidden="true"
    >
      <path
        ref="pathEl"
        :d="trail.path.value"
        class="trail__line trail__line--rest"
        fill="none"
      />

      <!-- The travelled portion: one dash the path's length, offset to end at the disc. -->
      <path
        :d="trail.path.value"
        class="trail__line trail__line--done"
        fill="none"
        :stroke-dasharray="trail.total.value"
        :stroke-dashoffset="behind"
      />

      <!-- A halo behind the disc, so the disc keeps its hard edge. -->
      <circle
        v-if="trail.halo.value > 0"
        :r="trail.dotSize.value / 2 + trail.halo.value"
        :style="seat"
        class="trail__halo"
      />

      <!-- Always rendered and faded when no row is current, so it travels from
           its last place. Positioned by transform for WebKitGTK. -->
      <circle
        :r="trail.dotSize.value / 2"
        :style="seat"
        class="trail__disc"
      />
    </svg>

    <v-list
      class="nav__list trail__rows"
      density="compact"
      nav
    >
      <template
        v-for="(row, i) in trail.rows.value"
        :key="row.key"
      >
        <v-list-subheader
          v-if="row.kind === 'head'"
          :style="insetAt(i)"
          class="s99ab-eyebrow nav__group trail__head"
        >
          {{ row.label }}
        </v-list-subheader>

        <!-- `to` or `href`, never both: with both, Vuetify routes and the new tab
             never opens. Active is computed here so the row and the disc agree. -->
        <v-list-item
          v-else-if="row.link"
          :to="row.link.newTab ? undefined : row.link.to"
          :href="row.link.newTab ? row.link.to : undefined"
          :target="row.link.newTab ? '_blank' : undefined"
          :rel="row.link.newTab ? 'noopener' : undefined"
          :active="i === trail.index.value"
          :prepend-icon="row.link.icon"
          :title="row.link.label"
          :style="insetAt(i)"
          :class="{ 'trail__row--group': row.startsGroup }"
          class="trail__row"
          @click="pick(i)"
        >
          <template
            v-if="row.link.newTab"
            #append
          >
            <v-icon
              class="nav__away"
              icon="mdi-open-in-new"
            />
          </template>

          <template
            v-else-if="row.link.badge !== undefined"
            #append
          >
            <v-chip size="x-small">
              {{ row.link.badge }}
            </v-chip>
          </template>
        </v-list-item>
      </template>
    </v-list>
  </div>
</template>

<script setup lang="ts">
import { computed, useTemplateRef, watchEffect } from 'vue'
import { useNavTrail } from '../../composables/shell/internal/navTrail'
import type { NavGroup, NavLit } from '../../types'

// A rail beside the nav with a disc that moves to the current page. The rows
// are ordinary v-list-items, so focus, routing and keyboard nav still apply.
const { groups, lit = 'both' } = defineProps<{
  groups: NavGroup[]
  /** The current-row style; see NavLit. `both` ties the row to the disc colour. */
  lit?: NavLit
}>()

const emit = defineEmits<{ navigate: [] }>()

// Unset follows the route. Bind it only for a nav driven by something else.
const active = defineModel<number | undefined>({ default: undefined })

const el = useTemplateRef<SVGPathElement>('pathEl')
const trail = useNavTrail(() => groups, active)

// Hands the composable the element refs it measures from.
watchEffect(() => {
  trail.pathEl.value = el.value
})

const hasActive = computed(() => trail.index.value >= 0)

/** The disc's position and visibility. See the template. */
const seat = computed(() => ({
  transform: `translate(${trail.dot.value.x}px, ${trail.dot.value.y}px)`,
  opacity: hasActive.value ? '1' : '0',
}))

// Clamped at 0: a larger offset would hide the whole stroke.
const behind = computed(() => Math.max(trail.total.value - trail.travelled.value, 0))

// Sets a property; the margin rule stays in _nav.scss.
function insetAt(i: number) {
  return { '--trail-inset': `${trail.insets.value[i] ?? 0}px` }
}

// Only with a bound model; otherwise the route moves the disc.
function pick(i: number) {
  if (active.value !== undefined) active.value = i
  emit('navigate')
}
</script>
