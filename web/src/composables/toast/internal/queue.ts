// web/src/composables/toast/internal/queue.ts
//
// Toast queues and timers as module state, so anything can raise a toast.

import { reactive } from 'vue'
import { POSITIONS, config } from './config'
import { inBrowser } from '../../../browser/env'
import type { Toast, ToastKind, ToastOptions, ToastPosition, ToastUpdate } from './types'

function emptyQueues(): Record<ToastPosition, Toast[]> {
  const out = {} as Record<ToastPosition, Toast[]>
  for (const p of POSITIONS) out[p] = []
  return out
}

// One queue per position, so a full corner does not delay a toast elsewhere.
export const queues = reactive(emptyQueues())

// Kept out of reactive state so replacing a timer rerenders nothing.
const timers = new Map<number, ReturnType<typeof setTimeout>>()

let nextId = 1

/** Visible toasts for a position; the rest wait. */
export function visibleAt(position: ToastPosition): Toast[] {
  return queues[position].slice(0, config.maxVisible)
}

export function queueDepth(position: ToastPosition): number {
  return Math.max(0, queues[position].length - config.maxVisible)
}

function clearTimer(id: number) {
  const handle = timers.get(id)
  if (handle !== undefined) {
    clearTimeout(handle)
    timers.delete(id)
  }
}

// End of the last booked countdown. Each new countdown is stretched to end a
// stagger later, so a batch leaves one at a time and each bar ends with its toast.
let lastDue = 0

function startTimer(t: Toast) {
  if (t.timeout <= 0 || timers.has(t.id)) return

  const now = Date.now()
  // Its own timeout, or a stagger after the last booking, whichever is later.
  t.runFor = Math.max(now + t.timeout, lastDue + config.stagger) - now
  lastDue = now + t.runFor
  timers.set(
    t.id,
    setTimeout(() => dismiss(t.id), t.runFor),
  )
}

/** Starts timers for visible toasts only, so a queued toast does not expire unseen. */
function pump(position: ToastPosition) {
  for (const t of visibleAt(position)) startTimer(t)
}

function find(id: number): Toast | undefined {
  for (const position of POSITIONS) {
    const t = queues[position].find(t => t.id === id)
    if (t) return t
  }
  return undefined
}

/** Stops the countdown. */
export function pause(id: number) {
  clearTimer(id)
}

/** Restarts the full countdown; the revision bump rebuilds the paused progress bar. */
export function resume(id: number) {
  const t = find(id)
  if (!t) return
  t.revision++
  startTimer(t)
}

export function dismiss(id: number) {
  clearTimer(id)
  for (const position of POSITIONS) {
    const i = queues[position].findIndex(t => t.id === id)
    if (i !== -1) {
      queues[position].splice(i, 1)
      pump(position)
      return
    }
  }
}

export function clear(position?: ToastPosition) {
  for (const p of position ? [position] : POSITIONS) {
    for (const t of queues[p]) clearTimer(t.id)
    queues[p].length = 0
  }
}

/**
 * Raises a toast and returns its id. A no-op on the server, where module state
 * is shared across requests.
 */
export function show(kind: ToastKind, text: string, opts: ToastOptions = {}): number {
  if (!inBrowser()) return 0

  const position = opts.position ?? config.position
  const timeout = opts.timeout ?? config.timeout[kind]
  const now = Date.now()

  // Same kind and text within the window bumps the count instead of stacking.
  if (opts.dedupe !== false) {
    const existing = queues[position].find(
      t =>
        t.kind === kind
        && t.text === text
        && now - t.createdAt < config.dedupeWindow,
    )
    if (existing) {
      existing.count++
      existing.createdAt = now
      existing.revision++
      clearTimer(existing.id)
      startTimer(existing)
      return existing.id
    }
  }

  const toast: Toast = {
    id: nextId++,
    kind,
    text,
    position,
    timeout,
    // Overwritten when the countdown starts.
    runFor: timeout,
    action: opts.action,
    count: 1,
    createdAt: now,
    revision: 0,
    progress: opts.progress,
    icon: opts.icon,
    closable: opts.closable,
    spin: opts.spin,
  }
  queues[position].push(toast)
  pump(position)
  return toast.id
}

/**
 * Changes a toast in place, keeping its stack slot, and restarts its countdown.
 * Returns false when the toast is gone.
 */
export function update(id: number, patch: ToastUpdate): boolean {
  const t = find(id)
  if (!t) return false

  // Object.assign keeps explicit undefined, so `{ icon: undefined }` restores the config glyph.
  Object.assign(t, patch)
  t.revision++
  clearTimer(id)
  startTimer(t)
  return true
}
/** Tests only. */
export function resetToasts() {
  clear()
  nextId = 1
  // A fake-timer test can leave this in the next test's future.
  lastDue = 0
}
