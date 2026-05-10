// web/src/composables/useShortcut.ts

import {
  type Component,
  computed,
  getCurrentInstance,
  onScopeDispose,
  reactive,
  readonly,
  toValue,
} from 'vue'
import { useDialog } from './useDialog'
import { useTranslate } from './useTranslate'

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

interface Binding {
  id: string
  handler: (event: KeyboardEvent) => void
  opts: ShortcutOptions
  /** Registration order; the newest match wins, so a dialog shadows a page. */
  seq: number
}

const defs = reactive<ShortcutMap>({})
const bindings = reactive<Binding[]>([])

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

function inEditable(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false
  if (target.isContentEditable) return true
  return ['input', 'textarea', 'select'].includes(target.tagName.toLowerCase())
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
      if (!b.opts.allowInInput && inEditable(event.target)) return false
      return b.opts.when ? b.opts.when() : true
    })

  const winner = matches[0]
  if (!winner) return

  // preventDefault only when something fires.
  event.preventDefault()
  winner.handler(event)
}

function listen() {
  if (listening || typeof window === 'undefined') return
  window.addEventListener('keydown', onKeydown)
  listening = true
}

function collides(id: string): string | undefined {
  const keys = normalise(resolveKeys(id) ?? '')
  if (!keys) return undefined

  for (const other of bindings) {
    if (other.id === id) continue
    if (normalise(resolveKeys(other.id) ?? '') === keys) return other.id
  }
  return undefined
}

/** Binds a handler to a shortcut id from the app's shortcuts file. */
export function useShortcut(
  id: string,
  handler: (event: KeyboardEvent) => void,
  opts: ShortcutOptions = {},
) {
  if (!defs[id] && typeof console !== 'undefined') {
    console.warn(
      `[s99ab] unknown shortcut id "${id}" - is it in shortcuts.ts?`,
    )
  }

  const clash = collides(id)
  if (clash && typeof console !== 'undefined') {
    console.warn(
      `[s99ab] shortcut "${id}" collides with "${clash}" on ${resolveKeys(id)}`,
    )
  }

  const binding: Binding = { id, handler, opts, seq: seq++ }
  bindings.push(binding)
  listen()

  // Unregisters with the component.
  if (getCurrentInstance()) {
    onScopeDispose(() => {
      const i = bindings.indexOf(binding)
      if (i !== -1) bindings.splice(i, 1)
    })
  }

  return () => {
    const i = bindings.indexOf(binding)
    if (i !== -1) bindings.splice(i, 1)
  }
}

export interface ActiveShortcut {
  id: string
  keys: string
  label: string
  group: string
}

/** Every live binding, for the help overlay. */
export function useShortcutRegistry() {
  const active = computed<ActiveShortcut[]>(() => {
    const seen = new Set<string>()
    const out: ActiveShortcut[] = []

    for (const b of bindings) {
      const def = defs[b.id]
      if (!def || seen.has(b.id)) continue
      if (def.desktopOnly && !desktop) continue
      if (b.opts.when && !toValue(b.opts.when)) continue

      seen.add(b.id)
      out.push({
        id: b.id,
        keys: resolveKeys(b.id) ?? def.keys,
        label: def.label,
        group: b.id.includes('.') ? b.id.split('.')[0]! : 'general',
      })
    }
    return out.sort(
      (a, b) => a.group.localeCompare(b.group) || a.id.localeCompare(b.id),
    )
  })

  return { active, defs: readonly(defs) }
}

let helpComponent: Component | undefined

/** Registered by the layer plugin to avoid an import cycle with the overlay. */
export function registerShortcutHelp(component: Component) {
  helpComponent = component
}

/** Opens the generated help overlay. */
export function useShortcutHelp() {
  const { openDialog } = useDialog()
  const t = useTranslate()

  return {
    open() {
      if (!helpComponent) {
        throw new Error(
          's99ab: shortcut help is not registered; is the layer plugin loaded?',
        )
      }
      // The title is also the dialog's accessible name.
      return openDialog(helpComponent, {}, {
        width: 'md',
        label: t('shortcut.title', 'Keyboard shortcuts'),
      })
    },
  }
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
