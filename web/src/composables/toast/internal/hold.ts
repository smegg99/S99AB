// web/src/composables/toast/internal/hold.ts

import { onBeforeUnmount, ref } from 'vue'
import { POSITIONS } from './config'
import { pause, resume, visibleAt } from './queue'
import { useToast } from '../useToast'

/** Pauses a toast's countdown on hover or hidden tab; the host binds its paused class to isPaused. */
export function useToastHold() {
  const { config } = useToast()

  // The toast under the pointer.
  const held = ref<number | null>(null)

  // CSS animations keep running in a hidden tab, so the bar needs this as well as the timer.
  const hidden = ref(false)

  function hold(id: number) {
    if (!config.pauseOnHover) return
    held.value = id
    pause(id)
  }

  function release(id: number) {
    if (held.value !== id) return
    held.value = null
    resume(id)
  }

  function isPaused(id: number): boolean {
    return held.value === id || (hidden.value && config.pauseWhenHidden)
  }

  // Document visibility, not window blur: blur fires on focus moving to devtools.
  function onVisibility() {
    if (!config.pauseWhenHidden) return

    hidden.value = document.hidden
    for (const position of POSITIONS) {
      for (const toast of visibleAt(position)) {
        if (document.hidden) pause(toast.id)
        // Keep the hovered toast paused.
        else if (held.value !== toast.id) resume(toast.id)
      }
    }
  }

  if (typeof document !== 'undefined') {
    document.addEventListener('visibilitychange', onVisibility)
    onBeforeUnmount(() => document.removeEventListener('visibilitychange', onVisibility))
  }

  return { hold, isPaused, release }
}
