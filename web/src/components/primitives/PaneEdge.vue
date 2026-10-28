<!-- web/src/components/primitives/PaneEdge.vue -->
<template>
  <!-- Mounted beside the clipped pane so WebKitGTK receives the whole resize hit area. -->
  <Teleport
    :to="host ?? 'body'"
    :disabled="!host"
  >
    <div
      v-bind="$attrs"
      class="s99ab-pane-edge"
      :style="{ left: `${(collapsed ? collapsedSize : width) - 2}px` }"
      role="separator"
      tabindex="0"
      aria-orientation="vertical"
      :aria-label="label"
      :aria-valuenow="collapsed ? collapsedSize : width"
      :aria-valuemin="collapsedSize"
      :aria-valuemax="max"
      @pointerdown="grab"
      @dblclick="onDblclick"
      @keydown="onKeydown"
    />
  </Teleport>
</template>

<script setup lang="ts">
import { onScopeDispose } from 'vue'
import { trackPointer } from '../../browser/pointer'

defineOptions({ inheritAttrs: false })
const { host, label, min, max, reset, collapsedSize = 44, foldAt = 96, unfoldAt = 128 } = defineProps<{
  /** The unclipped container shared by the pane and its content. */
  host: HTMLElement | null
  label: string
  min: number
  max: number
  reset: number
  collapsedSize?: number
  foldAt?: number
  unfoldAt?: number
}>()
const width = defineModel<number>('width', { required: true })
const collapsed = defineModel<boolean>('collapsed', { default: false })
const dragging = defineModel<boolean>('dragging', { default: false })
function resize(value: number) {
  width.value = Math.round(Math.min(max, Math.max(min, value)))
}

let stopDrag = () => {}
onScopeDispose(() => stopDrag())
function grab(event: PointerEvent) {
  if (event.button !== 0) return
  event.preventDefault()
  stopDrag()
  const from = event.clientX
  const start = collapsed.value ? collapsedSize : width.value
  // Folding keeps the width the pane had, for the next time it opens.
  const before = width.value
  const move = (e: PointerEvent) => {
    const dx = e.clientX - from
    if (!dragging.value && Math.abs(dx) < 4) return
    dragging.value = true
    const intended = start + dx
    if (collapsed.value) {
      if (intended < unfoldAt) return
      collapsed.value = false
      resize(intended)
    }
    else if (intended < foldAt) {
      resize(before)
      collapsed.value = true
    }
    else {
      resize(intended)
    }
  }
  stopDrag = trackPointer(event, {
    move,
    end: () => { dragging.value = false },
  })
}

function onDblclick() {
  if (collapsed.value) collapsed.value = false
  else resize(reset)
}

// The splitter's keys: the arrows resize and stop at the narrowest
// width, so a held key never folds; Enter folds and opens.
function onKeydown(event: KeyboardEvent) {
  // Modified arrows belong to application shortcuts.
  if (event.altKey || event.ctrlKey || event.metaKey) return
  const step = {
    ArrowLeft: -16,
    ArrowRight: 16,
  }[event.key]
  if (event.key === 'Enter' || (collapsed.value && event.key === 'ArrowRight')) {
    event.preventDefault()
    collapsed.value = !collapsed.value
    return
  }
  if (collapsed.value) return
  if (step !== undefined) {
    event.preventDefault()
    resize(width.value + step)
  }
  else if (event.key === 'Home' || event.key === 'End') {
    event.preventDefault()
    resize(event.key === 'Home' ? min : max)
  }
}
</script>

<style scoped>
.s99ab-pane-edge {
  position: absolute;
  top: 0;
  bottom: 0;
  z-index: 3;
  width: 10px;
  cursor: col-resize;
  touch-action: none;
}

.s99ab-pane-edge::after {
  position: absolute;
  top: 0;
  bottom: 0;
  left: 1px;
  width: 1px;
  background: transparent;
  content: '';
}

.s99ab-pane-edge:focus-visible {
  outline: none;
}

.s99ab-pane-edge:focus-visible::after {
  background: rgb(var(--v-theme-accent));
}
</style>
