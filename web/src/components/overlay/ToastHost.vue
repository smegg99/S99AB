<!-- web/src/components/overlay/ToastHost.vue -->
<template>
  <!-- Every position keeps its container, so the last toast's leave transition
       runs and the live region exists before its content. -->
  <div
    v-for="position in POSITIONS"
    :key="position"
    :class="['s99ab-toasts', `s99ab-toasts--${position}`, directionClass(position)]"
    :aria-live="urgency(position)"
  >
    <!-- No box: toasts are placed against the stack's edge. See UiMotion's `box`. -->
    <UiMotion
      :box="false"
      group
      name="toast"
      tag="div"
    >
      <div
        v-for="row in rowsAt(position)"
        :key="row.toast.id"
        :style="{ zIndex: row.z }"
        class="s99ab-toast-slot"
      >
        <div
          :ref="cardRef(row.toast.id)"
          :class="['s99ab-toast', row.classes, { 's99ab-toast--held': isPaused(row.toast.id) }]"
          :style="{ '--s99ab-toast-lift': row.lift }"
          @pointerenter="hold(row.toast.id)"
          @pointerleave="release(row.toast.id)"
        >
          <div class="s99ab-toast__row">
            <v-icon
              v-if="row.icon"
              :class="['s99ab-toast__icon', { 's99ab-spin': row.toast.spin }]"
              :icon="row.icon"
            />

            <p class="s99ab-toast__text">
              {{ row.toast.text }}
            </p>

            <!-- The count, the action, then the dismiss, on the first line. -->
            <div class="s99ab-toast__end s99ab-controls s99ab-controls--dense">
              <!-- The repeat count, in the kind's colour. role="img" so the
                   label is announced along with the digit. -->
              <span
                v-if="row.toast.count > 1"
                :aria-label="repeatLabel(row.toast.count)"
                class="s99ab-toast-marker s99ab-toast__count"
                role="img"
              >{{ row.toast.count }}</span>

              <!-- An icon, to keep the message width. -->
              <v-btn
                v-if="row.toast.action?.icon"
                :icon="row.toast.action.icon"
                :aria-label="row.toast.action.label"
                :title="row.toast.action.label"
                class="s99ab-toast__action"
                size="small"
                variant="text"
                @click="runAction(row.toast)"
              />
              <v-btn
                v-else-if="row.toast.action"
                class="s99ab-toast__action"
                size="small"
                variant="text"
                @click="runAction(row.toast)"
              >
                {{ row.toast.action.label }}
              </v-btn>

              <v-btn
                v-if="closableOf(row.toast)"
                :aria-label="closeLabel"
                class="s99ab-toast__close"
                icon="mdi-close"
                size="small"
                variant="text"
                @click="dismiss(row.toast.id)"
              />
            </div>
          </div>

          <!-- Keyed on the revision, so the bar restarts with the timer. -->
          <span
            v-if="row.bar"
            :key="row.toast.revision"
            :style="{ animationDuration: row.bar }"
            class="s99ab-toast__life"
          />
        </div>
      </div>
    </UiMotion>

    <!-- How many more are waiting, lifted past the whole stack. -->
    <UiMotion name="fade">
      <div
        v-if="queueDepth(position) > 0"
        class="s99ab-toast-slot"
      >
        <div
          :style="{ '--s99ab-toast-lift': moreLift(position) }"
          class="s99ab-toast-marker s99ab-toasts__more"
        >
          +{{ queueDepth(position) }}
        </div>
      </div>
    </UiMotion>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import UiMotion from '../motion/Motion.vue'
import { POSITIONS } from '../../composables/toast/internal/config'
import { type Toast, type ToastPosition, useToast } from '../../composables/toast/useToast'
import { useToastHold } from '../../composables/toast/internal/hold'
import { useToastStack } from '../../composables/toast/internal/rows'
import { useTranslate } from '../../composables/useTranslate'

// Mount once in app.vue, above every layout, or toasts appear twice.
const { closableOf, dismiss, queueDepth, visibleAt } = useToast()
const { cardRef, moreLift, rowsAt } = useToastStack()
const { hold, isPaused, release } = useToastHold()
const t = useTranslate()

const closeLabel = computed(() => t('common.close', 'Close'))

// A name for the bare number. The count goes into the message so the
// translation decides word order.
function repeatLabel(count: number): string {
  return t('common.repeatedCount', 'Repeated {count} times', { count })
}

// The stack grows away from its pinned edge.
function directionClass(position: ToastPosition): string {
  return position.startsWith('bottom') ? 's99ab-toasts--up' : 's99ab-toasts--down'
}

// Errors interrupt screen readers; other kinds wait.
function urgency(position: ToastPosition): 'assertive' | 'polite' {
  return visibleAt(position).some(toast => toast.kind === 'error') ? 'assertive' : 'polite'
}

function runAction(toast: Toast) {
  toast.action?.onClick()
  dismiss(toast.id)
}
</script>
