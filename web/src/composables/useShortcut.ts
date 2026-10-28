// web/src/composables/useShortcut.ts

import { computed, getCurrentInstance, onScopeDispose, readonly, toValue } from 'vue'
import {
  bind,
  bindings,
  collides,
  defs,
  helpOf,
  onDesktop,
  resolveKeys,
  type ShortcutOptions,
  unbind,
} from '../internal/shortcut'
import { useDialog } from './useDialog'
import { useTranslate } from './useTranslate'

export type { ShortcutDef, ShortcutMap, ShortcutOptions } from '../internal/shortcut'

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

  const binding = bind(id, handler, opts)

  // Unregisters with the component.
  if (getCurrentInstance()) onScopeDispose(() => unbind(binding))

  return () => unbind(binding)
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
      if (def.desktopOnly && !onDesktop()) continue
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

/** Opens the generated help overlay. */
export function useShortcutHelp() {
  const { openDialog } = useDialog()
  const t = useTranslate()

  return {
    open() {
      const helpComponent = helpOf()
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
