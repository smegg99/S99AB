<!-- web/src/components/motion/Motion.vue -->
<template>
  <!-- Motion off: no Transition at all, since an empty name still adds classes. -->
  <slot v-if="!enabled" />

  <!-- A grouped list also animates the box height, at the preset's own timing
       from _motion.scss, so the content below does not jump. -->
  <UiAutoHeight
    v-else-if="boxed"
    :class="`motion-auto--${preset}`"
    class="motion-auto"
  >
    <TransitionGroup
      v-bind="$attrs"
      :name="name"
      :tag="tag"
      class="motion-group"
      appear
    >
      <slot />
    </TransitionGroup>
  </UiAutoHeight>

  <!-- A group that places its own children, without the box. See `box`. -->
  <TransitionGroup
    v-else-if="group"
    v-bind="$attrs"
    :name="name"
    :tag="tag"
    class="motion-group"
    appear
  >
    <slot />
  </TransitionGroup>

  <!-- out-in by default. Nested out-in deadlocks (the outer re-render detaches
       the leaving element), so an inner UiMotion passes mode="default". -->
  <Transition
    v-else
    v-bind="$attrs"
    :name="name"
    :mode="mode === 'default' ? undefined : mode"
    appear
  >
    <slot />
  </Transition>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import UiAutoHeight from './AutoHeight.vue'
import { type MotionName, useMotion } from '../../composables/motion/useMotion'

// Attrs go to the transition, so a caller's classes land on the list.
defineOptions({ inheritAttrs: false })

// Callers name an intent; tokens and CSS decide timing and classes.
const {
  name: preset = 'fade',
  group,
  box = true,
  tag = 'div',
  mode = 'out-in',
} = defineProps<{
  name?: MotionName
  /** `out-in` unless nested inside another UiMotion; see the template. */
  mode?: 'out-in' | 'default'
  /** For a v-for. Uses TransitionGroup so each child animates. */
  group?: boolean
  /**
   * Animate the box around the list too. Off for a group that places its
   * children itself, where a resizing box would move every child.
   */
  box?: boolean
  tag?: string
}>()

const { resolved, nameFor } = useMotion()

const enabled = computed(() => resolved.value !== 'off')
const boxed = computed(() => group && box)
const name = computed(() => nameFor(preset))
</script>
