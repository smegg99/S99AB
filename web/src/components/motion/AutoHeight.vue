<!-- web/src/components/motion/AutoHeight.vue -->
<template>
  <div
    :style="boxStyle"
    class="autoheight"
  >
    <!-- The previous content, held behind the live content while the box
         closes, and hidden from the accessibility tree. -->
    <div
      ref="ghost"
      :hidden="!holding"
      aria-hidden="true"
      class="autoheight__ghost"
    />

    <div ref="content">
      <slot />
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, useTemplateRef, type CSSProperties } from 'vue'
import { useAutoHeight } from '../../composables/motion/useAutoHeight'

// Animates its own height when its content changes size, so the box follows
// rows entering and leaving. Uses the measured height, not max-height.
const { motion } = defineProps<{
  /**
   * Duration token. Unset, the box uses --autoheight-duration from the preset CSS.
   */
  motion?: 'fast' | 'base' | 'slow'
}>()

const content = useTemplateRef<HTMLElement>('content')
const ghost = useTemplateRef<HTMLElement>('ghost')

const { height, holding, measure } = useAutoHeight(content, ghost)

const boxStyle = computed<CSSProperties>(() => ({
  ...(height.value === null ? {} : { height: `${height.value}px` }),
  ...(motion ? { '--autoheight-duration': `var(--s99ab-motion-${motion})` } : {}),
}))

defineExpose({ measure })
</script>

<style scoped>
/* clip, so a caller can let travel through. Defaults to the floating label
   overhang so a form's first label is not cut; .motion-auto raises it. */
.autoheight {
  position: relative;
  overflow: clip;
  overflow-clip-margin: var(--autoheight-bleed, var(--s99ab-field-label-overhang));
  transition: height var(--autoheight-duration, var(--s99ab-motion-base)) var(--s99ab-motion-easing);
}

/* A block formatting context, so child margins are inside the measured height. */
.autoheight > * {
  display: flow-root;
}

/* Over the box, under the live content. */
.autoheight__ghost {
  position: absolute;
  inset: 0 0 auto;
  pointer-events: none;
}

.autoheight__ghost[hidden] {
  display: none;
}

:root[data-motion='reduced'] .autoheight,
:root[data-motion='off'] .autoheight {
  transition: none;
}

/* The document keeps the unresolved 'system' level, so this matches reduced
   motion that the selectors above miss. No ghost is kept in that case. */
@media (prefers-reduced-motion: reduce) {
  :root[data-motion='system'] .autoheight {
    transition: none;
  }
}
</style>
