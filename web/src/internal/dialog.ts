// web/src/internal/dialog.ts

import { type Component, markRaw, reactive } from 'vue'
import { focused, pressedByKey } from '../composables/primitives/internal/opener'

export type DialogWidth = 'sm' | 'md' | 'lg' | 'full'

export interface DialogOptions {
  /** Keep the instance between opens. Default false. */
  keepAlive?: boolean
  /** Backdrop and escape do not close it. */
  persistent?: boolean
  width?: DialogWidth
  /** The dialog's accessible name. */
  label?: string
}

export interface DialogEntry {
  id: number
  component: Component
  props: Record<string, unknown>
  opts: DialogOptions
  open: boolean
  resolve: (value?: unknown) => void
  /** The element focused when the dialog opened; it gets focus back on close. */
  opener: HTMLElement | null
  /** Whether a key opened the dialog; only then does the opener get its focus ring back. */
  openerRing: boolean
  /** Set by the dialog while its work runs: backdrop and escape do not close it. */
  held: boolean
}

export interface ConfirmOptions {
  title: string
  body?: string
  confirmLabel?: string
  cancelLabel?: string
  confirmColor?: string
}

export interface PromptOptions {
  title: string
  body?: string
  label?: string
  value?: string
  confirmLabel?: string
  cancelLabel?: string
  /** Each returns true, or the message under the field and in the disabled confirm key's tooltip. */
  rules?: Array<(v: string) => boolean | string>
  /** Saves the answer before closing; a returned string is an error shown under the field. */
  submit?: (value: string) => Promise<string | undefined>
  /** An extra action at the start of the keys, run like `submit`; on success the dialog closes with no answer. */
  secondary?: { label: string, color?: string, icon?: string, run: () => Promise<string | undefined> }
}

/** Injection key for the resolver of the dialog a component is rendered in. */
export const DIALOG_CLOSE = Symbol('s99ab:dialog-close')
export const DIALOG_HOLD = Symbol('s99ab:dialog-hold')

// The open stack, at module level. Exported raw for the host; consumers get the
// readonly view from useDialog().
export const dialogEntries = reactive<DialogEntry[]>([])
const entries = dialogEntries

let nextId = 1

// Set by the layer plugin, so the presets are opened without an import cycle.
let confirmComponent: Component | undefined
let promptComponent: Component | undefined

export function registerDialogPresets(confirm: Component, prompt: Component) {
  confirmComponent = confirm
  promptComponent = prompt
}

export function openDialog<T = unknown>(
  component: Component,
  props: Record<string, unknown> = {},
  opts: DialogOptions = {},
): Promise<T | undefined> {
  return new Promise<T | undefined>((resolve) => {
    // Reuse a closed keepAlive entry; pushing another would leave the first mounted.
    const kept = opts.keepAlive
      ? entries.find(e => !e.open && e.opts.keepAlive && e.component === component)
      : undefined

    if (kept) {
      kept.props = props
      kept.opts = opts
      kept.resolve = resolve as (value?: unknown) => void
      kept.opener = focused()
      kept.openerRing = pressedByKey()
      kept.open = true
      return
    }

    entries.push({
      id: nextId++,
      // markRaw: a component definition needs no reactivity.
      component: markRaw(component),
      props,
      opts,
      open: true,
      resolve: resolve as (value?: unknown) => void,
      opener: focused(),
      openerRing: pressedByKey(),
      held: false,
    })
  })
}

/**
 * Resolves an entry and removes it unless kept alive. Backdrop, escape and
 * host teardown all land here, so the promise always settles.
 */
export function closeDialog(id: number, value?: unknown) {
  const i = entries.findIndex(e => e.id === id)
  if (i === -1) return

  const entry = entries[i]!
  const opener = entry.opener
  const ring = entry.openerRing
  // What the dialog leaves holding the focus: its field or key, or nothing.
  const left = focused()
  entry.opener = null
  entry.open = false
  entry.resolve(value)
  if (!entry.opts.keepAlive) entries.splice(i, 1)

  // Vuetify refocuses only an activator, and the host has none. A later task, so the focus
  // trap is gone and WebKit does not ring it; skipped when the app moved focus meanwhile.
  if (opener) {
    setTimeout(() => {
      const now = focused()
      if (now && now !== left) return
      if (opener.isConnected) opener.focus({ preventScroll: true, focusVisible: ring } as FocusOptions)
    })
  }
}

/** Resolves every open dialog as cancelled. */
export function closeAllDialogs() {
  for (const entry of [...entries]) closeDialog(entry.id)
}

export function confirm(options: ConfirmOptions): Promise<boolean> {
  if (!confirmComponent) {
    throw new Error('s99ab: confirm presets are not registered; is the layer plugin loaded?')
  }
  return openDialog<boolean>(confirmComponent, { options }, { width: 'sm', label: options.title })
    .then(v => v === true)
}

export function prompt(options: PromptOptions): Promise<string | undefined> {
  if (!promptComponent) {
    throw new Error('s99ab: prompt presets are not registered; is the layer plugin loaded?')
  }
  return openDialog<string>(promptComponent, { options }, { width: 'sm', label: options.title })
}

/** Tests only. */
export function resetDialogs() {
  entries.length = 0
  nextId = 1
}
