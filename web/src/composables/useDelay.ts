// web/src/composables/useDelay.ts

import {
  onScopeDispose,
  reactive,
  readonly,
  ref,
  toValue,
  watch,
  type MaybeRefOrGetter,
  type Ref,
} from 'vue'

/**
 * How long a busy state waits before it shows (`appearAfter`) and how long it
 * stays once shown (`holdFor`), so neither a fast request nor a threshold
 * crossing flashes.
 */
export interface DelayConfig {
  appearAfter: number
  holdFor: number
}

const config = reactive<DelayConfig>({ appearAfter: 220, holdFor: 450 })

/** Called by the layer's Nuxt plugin with the app's s99ab.delay config. */
export function configureDelay(patch: Partial<DelayConfig>) {
  Object.assign(config, patch)
}

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

/**
 * Holds a promise, resolved or rejected, open for at least `holdFor`, so a
 * spinning button is visible long enough to read.
 *
 * ```ts
 * await settle(saveItem(draft))
 * ```
 */
export async function settle<T>(
  work: Promise<T>,
  options: Partial<DelayConfig> = {},
): Promise<T> {
  const holdFor = options.holdFor ?? config.holdFor
  const started = Date.now()

  try {
    return await work
  }
  finally {
    const left = holdFor - (Date.now() - started)
    if (left > 0) await new Promise(resolve => setTimeout(resolve, left))
  }
}
