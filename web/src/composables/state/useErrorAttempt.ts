// web/src/composables/state/useErrorAttempt.ts

import { ref, watch, type Ref } from 'vue'

/**
 * Counts errors that arrive on their own; UiErrorState keys its swap on it. An
 * error ending a caller-reported `retrying` is not counted. Both args are getters.
 */
export function useErrorAttempt(
  error: () => unknown,
  retrying: () => boolean,
): { attempt: Ref<number> } {
  const attempt = ref(0)

  // Set while a caller-reported retry runs; consumed by the error that ends it.
  const spun = ref(false)

  watch(retrying, (running) => {
    if (running) spun.value = true
  })

  // The falling edge, post-flush so the error watcher still sees the latch in
  // the same tick. Clears it when a retry fails with the same error object.
  watch(retrying, (running) => {
    if (!running) spun.value = false
  }, { flush: 'post' })

  watch(error, () => {
    if (spun.value) {
      spun.value = false
      return
    }
    attempt.value++
  })

  return { attempt }
}
