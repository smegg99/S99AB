// web/src/composables/toast/internal/types.ts
//
// Toast shapes only, so a component can take a Toast without importing the queue.

export type ToastPosition
  = | 'top-start'
    | 'top'
    | 'top-end'
    | 'bottom-start'
    | 'bottom'
    | 'bottom-end'

export type ToastKind = 'success' | 'error' | 'warning' | 'info'

/** Where a toast draws its remaining time. */
export type ToastProgress = 'bottom' | 'top' | 'none'

export interface ToastAction {
  /** Required: an icon-only button still needs an accessible name. */
  label: string
  /** Renders an icon button with the label as name and tooltip; otherwise a text button. */
  icon?: string
  onClick: () => void
}

/** Per-toast overrides; each falls back to `s99ab.toast` at render time. */
export interface ToastOptions {
  position?: ToastPosition
  /** ms. 0 means it waits for a dismiss. */
  timeout?: number
  action?: ToastAction
  /** Off for a toast that is meant to repeat, such as a counter. */
  dedupe?: boolean
  progress?: ToastProgress
  /** `false` for no glyph. */
  icon?: string | false
  /** Ignored when nothing else could dismiss the toast; see closableOf. */
  closable?: boolean
  /** Spins the glyph while the work is still running, as `promise` does. */
  spin?: boolean
}

export interface Toast {
  id: number
  kind: ToastKind
  text: string
  position: ToastPosition
  timeout: number
  /** The running countdown in ms: `timeout` plus any stagger. The bar draws this. */
  runFor: number
  action?: ToastAction
  /** Bumped for a duplicate; shown as a marker above 1. */
  count: number
  createdAt: number
  /** Unset follows the config; see ToastOptions. */
  progress?: ToastProgress
  icon?: string | false
  closable?: boolean
  spin?: boolean
  /** Bumped when the countdown restarts; the progress bar is keyed on it. */
  revision: number
}

/** Glyph per kind, overridable through `s99ab.toast.icons`. */
export type ToastIcons = Record<ToastKind, string> & {
  /** Shown by `promise` while the work runs. */
  pending: string
}

/** What `update` may change about a toast already on screen. */
export type ToastUpdate = Partial<
  Pick<
    Toast,
    | 'kind'
    | 'text'
    | 'timeout'
    | 'action'
    | 'progress'
    | 'icon'
    | 'closable'
    | 'spin'
  >
>
