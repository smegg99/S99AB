// web/src/internal/delay.ts

import { reactive } from 'vue'

/**
 * How long a busy state waits before it shows (`appearAfter`) and how long it
 * stays once shown (`holdFor`), so neither a fast request nor a threshold
 * crossing flashes.
 */
export interface DelayConfig {
  appearAfter: number
  holdFor: number
}

export const config = reactive<DelayConfig>({ appearAfter: 220, holdFor: 450 })

/** Called by the layer's Nuxt plugin with the app's s99ab.delay config. */
export function configureDelay(patch: Partial<DelayConfig>) {
  Object.assign(config, patch)
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
