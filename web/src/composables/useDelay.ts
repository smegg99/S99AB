// web/src/composables/useDelay.ts

import {
  onScopeDispose,
  readonly,
  ref,
  toValue,
  watch,
  type MaybeRefOrGetter,
  type Ref,
} from 'vue'
import { type DelayConfig, config } from '../internal/delay'

export type { DelayConfig } from '../internal/delay'

/** The live config, for a screen that needs to report its own pacing. */
export function useDelayConfig(): Readonly<DelayConfig> {
  return readonly(config)
}

/**
 * Gates a busy flag so it never flashes. Work finishing before `appearAfter`
 * shows nothing: the timer is cancelled.
 *
 * ```ts
 * const firstLoad = useDelayed(() => q.asyncStatus.value === 'loading')
 * ```
 */
export function useDelayed(
  source: MaybeRefOrGetter<boolean>,
  options: Partial<DelayConfig> = {},
): Ref<boolean> {
  const shown = ref(false)

  let appear: ReturnType<typeof setTimeout> | undefined
  let hold: ReturnType<typeof setTimeout> | undefined
  let shownAt = 0

  function clearTimers() {
    if (appear) clearTimeout(appear)
    if (hold) clearTimeout(hold)
    appear = undefined
    hold = undefined
  }

  watch(
    () => toValue(source),
    (busy) => {
      const appearAfter = options.appearAfter ?? config.appearAfter
      const holdFor = options.holdFor ?? config.holdFor

      if (busy) {
        // Busy again during the hold: keep what is on screen.
        if (hold) {
          clearTimeout(hold)
          hold = undefined
        }
        if (shown.value || appear) return
        appear = setTimeout(() => {
          appear = undefined
          shown.value = true
          shownAt = Date.now()
        }, appearAfter)
        return
      }

      // Finished before it was shown: cancel, so nothing appears.
      if (appear) {
        clearTimeout(appear)
        appear = undefined
        return
      }
      if (!shown.value || hold) return

      hold = setTimeout(
        () => {
          hold = undefined
          shown.value = false
        },
        Math.max(0, holdFor - (Date.now() - shownAt)),
      )
    },
    { immediate: true },
  )

  onScopeDispose(clearTimers)

  return shown
}
