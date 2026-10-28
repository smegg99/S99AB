// web/src/internal/shortcut.ts

import { type Component, reactive } from 'vue'
import { isEditable } from '../browser/input'
import { inBrowser } from '../browser/env'

export interface ShortcutDef {
  /** `mod+s`, `escape`, `shift+/`. `mod` is Cmd on macOS, Ctrl elsewhere. */
  keys: string
  /** i18n key, rendered by the help overlay. */
  label: string
  /** Browser-owned combos (`mod+n`, `mod+t`, `mod+w`), registered on desktop only. */
  desktopOnly?: boolean
}

export type ShortcutMap = Record<string, ShortcutDef>

export interface ShortcutOptions {
  /** Checked when the key fires; false lets the event through. */
  when?: () => boolean
  /** A named scope shadows global bindings for the same combo while active. */
  scope?: string
  /** Off by default, so typing in a field does not trigger shortcuts. */
  allowInInput?: boolean
}

export interface Binding {
  id: string
  handler: (event: KeyboardEvent) => void
  opts: ShortcutOptions
  /** Registration order; the newest match wins, so a dialog shadows a page. */
  seq: number
}

export const defs = reactive<ShortcutMap>({})
export const bindings = reactive<Binding[]>([])

let overrides: () => Record<string, string | undefined> = () => ({})
let desktop = false
let seq = 0
let listening = false

/** The app's shortcuts.ts, installed by the layer plugin. */
export function registerShortcuts(map: ShortcutMap) {
  Object.assign(defs, map)
}

/** Remapped keys, from the config file on desktop or the persisted store on web. */
export function setShortcutOverrides(
  getter: () => Record<string, string | undefined>,
) {
  overrides = getter
}

/** Whether desktopOnly bindings are live. Set by a desktop shell at boot. */
export function setDesktop(value: boolean) {
  desktop = value
}

export function isMac(): boolean {
  if (typeof navigator === 'undefined') return false
  return /mac|iphone|ipad/i.test(navigator.platform || navigator.userAgent)
}

/** The keys a binding answers to, after any override. */
export function resolveKeys(id: string): string | undefined {
  const override = overrides()[id]
  return override ?? defs[id]?.keys
}

/** A keyboard event as a normalised combo, from `event.key` so non-QWERTY layouts work. */
export function comboOf(event: KeyboardEvent): string {
  const parts: string[] = []
  const mod = isMac() ? event.metaKey : event.ctrlKey

  if (mod) parts.push('mod')
  // The other modifier still counts: ctrl+s on a Mac is not mod+s.
  if (isMac() ? event.ctrlKey : event.metaKey) parts.push('meta')
  if (event.altKey) parts.push('alt')
  if (event.shiftKey) parts.push('shift')

  const key
    = event.key.length === 1 ? event.key.toLowerCase() : event.key.toLowerCase()
  if (!['control', 'meta', 'alt', 'shift'].includes(key)) parts.push(key)

  return parts.join('+')
}

function normalise(keys: string): string {
  return keys
    .split('+')
    .map(k => k.trim().toLowerCase())
    .filter(Boolean)
    .join('+')
}

function onKeydown(event: KeyboardEvent) {
  const combo = comboOf(event)

  // Newest first, so a dialog's binding shadows the page's.
  const matches = [...bindings]
    .sort((a, b) => b.seq - a.seq)
    .filter((b) => {
      const def = defs[b.id]
      if (!def) return false
      if (def.desktopOnly && !desktop) return false
      if (normalise(resolveKeys(b.id) ?? '') !== combo) return false
      if (!b.opts.allowInInput && isEditable(event.target)) return false
      return b.opts.when ? b.opts.when() : true
    })

  const winner = matches[0]
  if (!winner) return

  // preventDefault only when something fires.
  event.preventDefault()
  winner.handler(event)
}

export function listen() {
  if (listening || !inBrowser()) return
  window.addEventListener('keydown', onKeydown)
  listening = true
}

export function collides(id: string): string | undefined {
  const keys = normalise(resolveKeys(id) ?? '')
  if (!keys) return undefined

  for (const other of bindings) {
    if (other.id === id) continue
    if (normalise(resolveKeys(other.id) ?? '') === keys) return other.id
  }
  return undefined
}

/** Adds a binding; the newest match wins. */
export function bind(id: string, handler: (event: KeyboardEvent) => void, opts: ShortcutOptions): Binding {
  const binding: Binding = { id, handler, opts, seq: seq++ }
  bindings.push(binding)
  listen()
  return binding
}

export function unbind(binding: Binding) {
  const i = bindings.indexOf(binding)
  if (i !== -1) bindings.splice(i, 1)
}

/** Whether desktop-only shortcuts count. */
export function onDesktop(): boolean {
  return desktop
}

let helpComponent: Component | undefined

/** Registered by the layer plugin to avoid an import cycle with the overlay. */
export function registerShortcutHelp(component: Component) {
  helpComponent = component
}

/** The registered help overlay, if the plugin ran. */
export function helpOf(): Component | undefined {
  return helpComponent
}

/** Tests only. */
export function resetShortcuts() {
  // Cleared in place: other closures hold a reference to `defs`.
  // eslint-disable-next-line @typescript-eslint/no-dynamic-delete
  for (const key of Object.keys(defs)) delete defs[key]
  bindings.length = 0
  overrides = () => ({})
  desktop = false
  seq = 0
}
