// web/src/composables/toast/internal/config.ts
//
// App-wide toast defaults and the resolvers that fill in what a toast leaves out.
// Resolved at render time, so a config change also moves toasts already on screen.

import type {
  Toast,
  ToastIcons,
  ToastKind,
  ToastPosition,
  ToastProgress,
} from './types'

export interface ToastConfig {
  position: ToastPosition
  timeout: Record<ToastKind, number>
  maxVisible: number
  dedupeWindow: number
  /** Minimum ms between two expiries; added to the countdown. Manual dismiss never waits. */
  stagger: number
  progress: ToastProgress
  /** Off for a text-only toast. */
  icon: boolean
  icons: ToastIcons
  /** A toast nothing else can dismiss keeps its close button regardless. */
  closable: boolean
  /** Holds the countdown while the pointer is over a toast. */
  pauseOnHover: boolean
  /** Holds the countdown while the tab is hidden, so a toast does not expire unseen. */
  pauseWhenHidden: boolean
}

export const POSITIONS: readonly ToastPosition[] = [
  'top-start',
  'top',
  'top-end',
  'bottom-start',
  'bottom',
  'bottom-end',
] as const

// Errors wait for a dismiss.
export const config: ToastConfig = {
  position: 'bottom-end',
  timeout: { success: 3000, info: 4000, warning: 6000, error: 0 },
  maxVisible: 3,
  dedupeWindow: 1000,
  stagger: 220,
  progress: 'bottom',
  icon: true,
  icons: {
    success: 'mdi-check-circle-outline',
    info: 'mdi-information-outline',
    warning: 'mdi-alert-outline',
    error: 'mdi-alert-circle-outline',
    pending: 'mdi-loading',
  },
  closable: true,
  pauseOnHover: true,
  pauseWhenHidden: true,
}

/** A partial override; the maps merge per entry. */
export type ToastConfigPatch = Partial<
  Omit<ToastConfig, 'timeout' | 'icons'>
> & {
  timeout?: Partial<Record<ToastKind, number>>
  icons?: Partial<ToastIcons>
}

/** Called by the layer's Nuxt plugin with the app's s99ab.toast config. */
export function configureToast(patch: ToastConfigPatch) {
  // Merge the maps per entry so { timeout: { success: 500 } } keeps the other kinds.
  const { timeout, icons, ...rest } = patch
  Object.assign(config, rest)
  if (timeout) Object.assign(config.timeout, timeout)
  if (icons) Object.assign(config.icons, icons)
}
export function progressOf(t: Toast): ToastProgress {
  return t.progress ?? config.progress
}

export function iconOf(t: Toast): string | null {
  if (t.icon === false) return null
  if (typeof t.icon === 'string') return t.icon
  return config.icon ? config.icons[t.kind] : null
}

// A toast with no countdown and no action keeps its close button, or it could never be dismissed.
export function closableOf(t: Toast): boolean {
  const asked = t.closable ?? config.closable
  return asked || (t.timeout <= 0 && !t.action)
}
