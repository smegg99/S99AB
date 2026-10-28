<!-- web/src/components/primitives/DisabledHint.vue -->
<template>
  <!-- The host is the root, so a consumer's classes and scope id land on the
       element that takes the control's place in its flex or grid. -->
  <div
    class="s99ab-disabled-hint"
    :class="{ 's99ab-disabled-hint--disabled': !!reason, 's99ab-disabled-hint--block': block }"
    :tabindex="reason ? 0 : undefined"
    :role="reason ? 'group' : undefined"
    :aria-label="reason ? label || reason : undefined"
    :aria-disabled="reason ? true : undefined"
    @pointerdown.capture="blockAction"
    @click.capture="blockAction"
    @auxclick.capture="blockAction"
    @dblclick.capture="blockAction"
    @keydown.capture="key"
    @keyup.capture="key"
  >
    <slot />
    <!-- Mounted only with a reason: while mounted, the tooltip keeps
         aria-describedby on the host whatever its disabled prop says. -->
    <v-tooltip
      v-if="reason"
      v-model="open"
      activator="parent"
      :text="reason"
      :open-on-focus="true"
      :transition="false"
      :location="location"
    />
  </div>
</template>

<script setup lang="ts">
import { computed, onBeforeUnmount, watch } from 'vue'
import { hintTooltipOpen, setHintTooltipOpen } from '../../composables/primitives/internal/tooltip'

/** Keep the child natively disabled; this focusable host explains why. */
const { reason, label = '', block, location = 'bottom' } = defineProps<{
  reason: string
  label?: string
  /** Fields, list rows and other controls which fill their layout cell. */
  block?: boolean
  /** Where the reason opens. A menu row opens it beside itself, off the next row. */
  location?: 'top' | 'bottom' | 'start' | 'end'
}>()
// One reason open per window; the last opened wins (primitives/internal/tooltip.ts).
const self = {}
const open = computed({
  get: () => hintTooltipOpen(self),
  set: (value: boolean) => setHintTooltipOpen(self, value),
})
watch(() => reason, () => {
  open.value = false
})
onBeforeUnmount(() => {
  open.value = false
})

function blockAction(event: Event) {
  if (!reason) return
  event.preventDefault()
  event.stopPropagation()
}

function key(event: KeyboardEvent) {
  if (event.key === 'Enter' || event.key === ' ') blockAction(event)
  if (event.key === 'Escape') open.value = false
}
</script>

<style scoped>
.s99ab-disabled-hint { display: inline-flex; min-width: 0; max-width: 100%; vertical-align: middle; flex-shrink: 0; }
.s99ab-disabled-hint--block { display: block; width: 100%; }
/* The focus ring follows the corner of the control it stands in for. */
.s99ab-disabled-hint--disabled { border-radius: var(--s99ab-radius); }
</style>
