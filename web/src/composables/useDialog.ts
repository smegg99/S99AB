// web/src/composables/useDialog.ts

import {
  type Component,
  getCurrentInstance,
  inject,
  markRaw,
  reactive,
  readonly,
} from 'vue'

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
  rules?: Array<(v: string) => boolean | string>
}

/** Injection key for the resolver of the dialog a component is rendered in. */
export const DIALOG_CLOSE = Symbol('s99ab:dialog-close')

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

function openDialog<T = unknown>(
  component: Component,
  props: Record<string, unknown> = {},
  opts: DialogOptions = {},
): Promise<T | undefined> {
  return new Promise<T | undefined>((resolve) => {
    // A keepAlive dialog is reopened: its entry stays in the stack after close,
    // so pushing a second one would leave the first mounted.
    const kept = opts.keepAlive
      ? entries.find(e => !e.open && e.opts.keepAlive && e.component === component)
      : undefined

    if (kept) {
      kept.props = props
      kept.opts = opts
      kept.resolve = resolve as (value?: unknown) => void
      kept.open = true
      return
    }

    entries.push({
      id: nextId++,
    // markRaw: a component definition is not state.
      component: markRaw(component),
      props,
      opts,
      open: true,
      resolve: resolve as (value?: unknown) => void,
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
  entry.open = false
  entry.resolve(value)

  if (entry.opts.keepAlive) return
  entries.splice(i, 1)
}

/** Resolves every open dialog as cancelled. */
export function closeAllDialogs() {
  for (const entry of [...entries]) closeDialog(entry.id)
}

function confirm(options: ConfirmOptions): Promise<boolean> {
  if (!confirmComponent) {
    throw new Error('s99ab: confirm presets are not registered; is the layer plugin loaded?')
  }
  return openDialog<boolean>(confirmComponent, { options }, { width: 'sm', label: options.title })
    .then(v => v === true)
}

function prompt(options: PromptOptions): Promise<string | undefined> {
  if (!promptComponent) {
    throw new Error('s99ab: prompt presets are not registered; is the layer plugin loaded?')
  }
  return openDialog<string>(promptComponent, { options }, { width: 'sm', label: options.title })
}

const noop = () => {}

/**
 * Opens dialogs; inside a dialog it also closes the current one. The resolver
 * is injected by the host, so a dialog needs no close prop or id.
 */
export function useDialog<T = unknown>() {
  const close = getCurrentInstance()
    ? inject<(value?: T) => void>(DIALOG_CLOSE, noop)
    : noop

  return {
    entries: readonly(entries),
    openDialog,
    confirm,
    prompt,
    close,
    closeAll: closeAllDialogs,
  }
}

/** Tests only. */
export function resetDialogs() {
  entries.length = 0
  nextId = 1
}
