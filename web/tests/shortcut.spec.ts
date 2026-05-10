// web/tests/shortcut.spec.ts

import { defineComponent, h } from 'vue'
import { mount } from '@vue/test-utils'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import {
  comboOf,
  registerShortcuts,
  resetShortcuts,
  resolveKeys,
  setDesktop,
  setShortcutOverrides,
  useShortcut,
  useShortcutRegistry,
} from '../src/composables/useShortcut'

const SHORTCUTS = {
  'app.save': { keys: 'mod+s', label: 'shortcut.save' },
  'app.search': { keys: 'mod+k', label: 'shortcut.search' },
  'app.close': { keys: 'escape', label: 'shortcut.close' },
  'session.new': { keys: 'mod+n', label: 'shortcut.newSession', desktopOnly: true },
}

beforeEach(() => {
  resetShortcuts()
  registerShortcuts(SHORTCUTS)
  // Not a Mac by default, so mod is Ctrl.
  vi.stubGlobal('navigator', { platform: 'Linux x86_64', userAgent: 'linux' })
})

afterEach(() => {
  vi.unstubAllGlobals()
  vi.restoreAllMocks()
})

function press(keys: Partial<KeyboardEventInit>, target?: Element) {
  const event = new KeyboardEvent('keydown', { bubbles: true, cancelable: true, ...keys })
  ;(target ?? window).dispatchEvent(event)
  return event
}

/** Registers a binding inside a component, as a real call site does. */
function bind(id: string, handler: (e: KeyboardEvent) => void, opts = {}) {
  return mount(defineComponent({
    setup() {
      useShortcut(id, handler, opts)
      return () => h('div')
    },
  }))
}

describe('combo parsing', () => {
  it('reads ctrl as mod off a Mac', () => {
    expect(comboOf(new KeyboardEvent('keydown', { key: 's', ctrlKey: true }))).toBe('mod+s')
  })

  it('reads cmd as mod on a Mac', () => {
    vi.stubGlobal('navigator', { platform: 'MacIntel', userAgent: 'mac' })
    expect(comboOf(new KeyboardEvent('keydown', { key: 's', metaKey: true }))).toBe('mod+s')
  })

  it('lowercases and keeps named keys whole', () => {
    expect(comboOf(new KeyboardEvent('keydown', { key: 'Escape' }))).toBe('escape')
    expect(comboOf(new KeyboardEvent('keydown', { key: 'S' }))).toBe('s')
  })

  it('includes other modifiers', () => {
    expect(comboOf(new KeyboardEvent('keydown', { key: 'k', ctrlKey: true, shiftKey: true })))
      .toBe('mod+shift+k')
  })

  it('ignores a bare modifier press', () => {
    expect(comboOf(new KeyboardEvent('keydown', { key: 'Control', ctrlKey: true }))).toBe('mod')
  })
})

describe('firing', () => {
  it('calls the handler for its combo', () => {
    const handler = vi.fn()
    bind('app.save', handler)

    press({ key: 's', ctrlKey: true })
    expect(handler).toHaveBeenCalledOnce()
  })

  it('ignores a different combo', () => {
    const handler = vi.fn()
    bind('app.save', handler)

    press({ key: 'j', ctrlKey: true })
    expect(handler).not.toHaveBeenCalled()
  })

  // An unbound combo keeps the browser default.
  it('prevents the default only when it handles the event', () => {
    bind('app.save', () => {})

    expect(press({ key: 's', ctrlKey: true }).defaultPrevented).toBe(true)
    expect(press({ key: 'j', ctrlKey: true }).defaultPrevented).toBe(false)
  })

  it('honours a when guard', () => {
    const handler = vi.fn()
    let allowed = false
    bind('app.save', handler, { when: () => allowed })

    press({ key: 's', ctrlKey: true })
    expect(handler).not.toHaveBeenCalled()

    allowed = true
    press({ key: 's', ctrlKey: true })
    expect(handler).toHaveBeenCalledOnce()
  })
})

describe('inputs', () => {
  // Typing "s" in a search box must not trigger save.
  it('does not fire while an input has focus', () => {
    const handler = vi.fn()
    bind('app.save', handler)

    const input = document.createElement('input')
    document.body.appendChild(input)
    press({ key: 's', ctrlKey: true }, input)

    expect(handler).not.toHaveBeenCalled()
    input.remove()
  })

  it('fires in an input when the binding opts in', () => {
    const handler = vi.fn()
    bind('app.save', handler, { allowInInput: true })

    const input = document.createElement('input')
    document.body.appendChild(input)
    press({ key: 's', ctrlKey: true }, input)

    expect(handler).toHaveBeenCalledOnce()
    input.remove()
  })
})

describe('lifetime and shadowing', () => {
  it('unregisters when its component unmounts', () => {
    const handler = vi.fn()
    const wrapper = bind('app.save', handler)

    wrapper.unmount()
    press({ key: 's', ctrlKey: true })

    expect(handler).not.toHaveBeenCalled()
  })

  // A dialog registers after the page under it, so its binding wins.
  it('the newest binding shadows an older one for the same combo', () => {
    const page = vi.fn()
    const dialog = vi.fn()
    bind('app.close', page)
    bind('app.close', dialog)

    press({ key: 'Escape' })

    expect(dialog).toHaveBeenCalledOnce()
    expect(page).not.toHaveBeenCalled()
  })

  it('falls back to the older binding once the newer one goes', () => {
    const page = vi.fn()
    const dialog = vi.fn()
    bind('app.close', page)
    const overlay = bind('app.close', dialog)

    overlay.unmount()
    press({ key: 'Escape' })

    expect(page).toHaveBeenCalledOnce()
  })
})

describe('overrides', () => {
  it('prefers a user override over the declared keys', () => {
    setShortcutOverrides(() => ({ 'app.save': 'mod+e' }))
    const handler = vi.fn()
    bind('app.save', handler)

    press({ key: 's', ctrlKey: true })
    expect(handler).not.toHaveBeenCalled()

    press({ key: 'e', ctrlKey: true })
    expect(handler).toHaveBeenCalledOnce()
  })

  it('resolveKeys reports the effective binding', () => {
    expect(resolveKeys('app.save')).toBe('mod+s')
    setShortcutOverrides(() => ({ 'app.save': 'mod+e' }))
    expect(resolveKeys('app.save')).toBe('mod+e')
  })
})

describe('desktopOnly', () => {
  // The browser owns mod+n, so on web the binding never fires.
  it('does not fire on web', () => {
    const handler = vi.fn()
    bind('session.new', handler)

    press({ key: 'n', ctrlKey: true })
    expect(handler).not.toHaveBeenCalled()
  })

  it('fires on desktop', () => {
    setDesktop(true)
    const handler = vi.fn()
    bind('session.new', handler)

    press({ key: 'n', ctrlKey: true })
    expect(handler).toHaveBeenCalledOnce()
  })
})

describe('registry', () => {
  it('lists what is bound, not what is declared', () => {
    bind('app.save', () => {})

    const { active } = useShortcutRegistry()
    expect(active.value.map(s => s.id)).toEqual(['app.save'])
  })

  it('groups by the id prefix', () => {
    bind('app.save', () => {})
    bind('app.search', () => {})

    const { active } = useShortcutRegistry()
    expect(active.value.every(s => s.group === 'app')).toBe(true)
  })

  it('reports overridden keys, so the overlay cannot go stale', () => {
    setShortcutOverrides(() => ({ 'app.save': 'mod+e' }))
    bind('app.save', () => {})

    expect(useShortcutRegistry().active.value[0]!.keys).toBe('mod+e')
  })

  it('hides a desktopOnly binding on web', () => {
    bind('session.new', () => {})
    expect(useShortcutRegistry().active.value).toHaveLength(0)
  })

  it('hides a binding whose guard is false', () => {
    bind('app.save', () => {}, { when: () => false })
    expect(useShortcutRegistry().active.value).toHaveLength(0)
  })
})

describe('warnings', () => {
  it('warns about an unknown id rather than failing silently', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})
    bind('nope.missing', () => {})

    expect(warn).toHaveBeenCalledWith(expect.stringContaining('unknown shortcut id'))
  })

  it('warns when two bindings claim the same combo', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})
    setShortcutOverrides(() => ({ 'app.search': 'mod+s' }))
    bind('app.save', () => {})
    bind('app.search', () => {})

    expect(warn).toHaveBeenCalledWith(expect.stringContaining('collides'))
  })
})
