// web/src/composables/toast/useToast.ts
//
// Public toast API; types, config and queue stay internal.
// `promise` lives here because it is paced by s99ab.delay and the queue is not.

import { readonly } from 'vue'
import { useDelayConfig } from '../useDelay'
import { closableOf, config, iconOf, progressOf } from './internal/config'
import type { ToastConfig } from './internal/config'
import {
  clear,
  dismiss,
  pause,
  queueDepth,
  queues,
  resume,
  show,
  update,
  visibleAt,
} from './internal/queue'
import type { ToastKind, ToastOptions } from './internal/types'

export type {
  Toast,
  ToastAction,
  ToastIcons,
  ToastKind,
  ToastOptions,
  ToastPosition,
  ToastProgress,
  ToastUpdate,
} from './internal/types'
export type { ToastConfig, ToastConfigPatch } from './internal/config'

/** A string, or a function of what the work returned or threw. */
type Said<T> = string | ((subject: T) => string)

function say<T>(said: Said<T> | undefined, subject: T): string | undefined {
  return typeof said === 'function' ? said(subject) : said
}

/** Text per stage of a piece of work; every stage is optional. */
export interface ToastPromise<T> {
  /** Shown only when the work outlasts `appearAfter`. */
  pending?: string
  success?: Said<T>
  /** Takes the thrown value, e.g. `e => useApiError()(e).text`. */
  error?: Said<unknown>
}

/**
 * One toast for a piece of work: pending, then its outcome in place, paced by s99ab.delay.
 * Rethrows, so the caller still handles the error.
 */
async function promise<T>(
  work: Promise<T>,
  said: ToastPromise<T>,
  opts: ToastOptions = {},
): Promise<T> {
  const delay = useDelayConfig()
  let id = 0
  let shownAt = 0

  const appear
    = said.pending === undefined
      ? undefined
      : setTimeout(() => {
          id = show('info', said.pending!, {
            ...opts,
            // Ends with the work, and is never deduped against another pending toast.
            timeout: 0,
            dedupe: false,
            icon: config.icons.pending,
            spin: true,
          })
          shownAt = Date.now()
        }, delay.appearAfter)

  async function land(kind: ToastKind, text: string | undefined) {
    if (appear !== undefined) clearTimeout(appear)

    if (id) {
      const left = delay.holdFor - (Date.now() - shownAt)
      if (left > 0) await new Promise(done => setTimeout(done, left))
    }

    // No text for this outcome: drop the pending toast.
    if (text === undefined) {
      if (id) dismiss(id)
      return
    }

    // Update in place, or show a new toast if the user dismissed the pending one.
    const became = id
      ? update(id, {
          kind,
          text,
          timeout: opts.timeout ?? config.timeout[kind],
          spin: false,
          icon: opts.icon,
        })
      : false
    if (!became) show(kind, text, opts)
  }

  try {
    const value = await work
    await land('success', say(said.success, value))
    return value
  }
  catch (err) {
    await land('error', say(said.error, err))
    throw err
  }
}
export function useToast() {
  return {
    queues: readonly(queues),
    visibleAt,
    progressOf,
    iconOf,
    closableOf,
    queueDepth,
    show,
    update,
    promise,
    dismiss,
    clear,
    pause,
    resume,
    success: (text: string, o?: ToastOptions) => show('success', text, o),
    error: (text: string, o?: ToastOptions) => show('error', text, o),
    warning: (text: string, o?: ToastOptions) => show('warning', text, o),
    info: (text: string, o?: ToastOptions) => show('info', text, o),
    /** Read-only resolved config for a host to render with. */
    config: readonly(config) as Readonly<ToastConfig>,
  }
}
