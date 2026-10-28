// web/tests/dialog.spec.ts

import { defineComponent, h, nextTick } from 'vue'
import { mount } from '@vue/test-utils'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import {
  closeAllDialogs,
  closeDialog,
  dialogEntries,
  registerDialogPresets,
  resetDialogs,
} from '../src/internal/dialog'
import { useDialog } from '../src/composables/useDialog'

const Stub = defineComponent({ name: 'Stub', setup: () => () => h('div') })

beforeEach(() => {
  resetDialogs()
})

function inComponent<T>(fn: () => T): T {
  let out!: T
  mount(defineComponent({
    setup() {
      out = fn()
      return () => h('div')
    },
  }))
  return out
}

describe('opening', () => {
  it('adds an entry and leaves the promise pending', async () => {
    const { openDialog } = useDialog()
    let settled = false
    void openDialog(Stub).then(() => {
      settled = true
    })

    expect(dialogEntries).toHaveLength(1)
    expect(dialogEntries[0]!.open).toBe(true)
    await Promise.resolve()
    expect(settled).toBe(false)
  })

  it('passes props through to the component', () => {
    useDialog().openDialog(Stub, { item: { id: 'a' } })
    expect(dialogEntries[0]!.props).toEqual({ item: { id: 'a' } })
  })

  it('stacks independent entries with distinct ids', () => {
    const { openDialog } = useDialog()
    void openDialog(Stub)
    void openDialog(Stub)

    expect(dialogEntries).toHaveLength(2)
    expect(dialogEntries[0]!.id).not.toBe(dialogEntries[1]!.id)
  })
})

describe('resolving', () => {
  it('resolves with the value close was given', async () => {
    const promise = useDialog<string>().openDialog<string>(Stub)
    closeDialog(dialogEntries[0]!.id, 'saved')

    await expect(promise).resolves.toBe('saved')
  })

  // undefined means cancelled, on every path out.
  it('resolves undefined when closed with no value', async () => {
    const promise = useDialog().openDialog(Stub)
    closeDialog(dialogEntries[0]!.id)

    await expect(promise).resolves.toBeUndefined()
  })

  it('resolves each stacked dialog independently', async () => {
    const { openDialog } = useDialog()
    const first = openDialog<string>(Stub)
    const second = openDialog<string>(Stub)

    const [a, b] = [dialogEntries[0]!.id, dialogEntries[1]!.id]
    closeDialog(b, 'second')
    closeDialog(a, 'first')

    await expect(first).resolves.toBe('first')
    await expect(second).resolves.toBe('second')
  })

  it('closeAll resolves everything as cancelled', async () => {
    const { openDialog } = useDialog()
    const first = openDialog(Stub)
    const second = openDialog(Stub)

    closeAllDialogs()

    await expect(first).resolves.toBeUndefined()
    await expect(second).resolves.toBeUndefined()
    expect(dialogEntries).toHaveLength(0)
  })

  it('ignores a close for an id that is gone', async () => {
    const promise = useDialog().openDialog(Stub)
    const id = dialogEntries[0]!.id

    closeDialog(id, 'once')
    closeDialog(id, 'twice') // must not throw or re-resolve

    await expect(promise).resolves.toBe('once')
  })
})

describe('lifetime', () => {
  // Lazy by default: the entry is removed, so the next open starts fresh.
  it('removes the entry on close by default', () => {
    useDialog().openDialog(Stub)
    closeDialog(dialogEntries[0]!.id)

    expect(dialogEntries).toHaveLength(0)
  })

  it('keeps a keepAlive entry, marked closed', () => {
    useDialog().openDialog(Stub, {}, { keepAlive: true })
    closeDialog(dialogEntries[0]!.id)

    expect(dialogEntries).toHaveLength(1)
    expect(dialogEntries[0]!.open).toBe(false)
  })

  // Reopening a keepAlive dialog reuses its entry instead of pushing another.
  it('does not grow the stack across repeated opens of a keepAlive dialog', () => {
    const { openDialog } = useDialog()

    for (let i = 0; i < 10; i++) {
      void openDialog(Stub, {}, { keepAlive: true })
      closeDialog(dialogEntries[0]!.id)
    }

    expect(dialogEntries).toHaveLength(1)
  })

  // The reused entry takes the new open's resolver.
  it('resolves the second open of a keepAlive dialog', async () => {
    const { openDialog } = useDialog()

    const first = openDialog<string>(Stub, {}, { keepAlive: true })
    closeDialog(dialogEntries[0]!.id, 'one')
    await expect(first).resolves.toBe('one')

    const second = openDialog<string>(Stub, {}, { keepAlive: true })
    expect(dialogEntries).toHaveLength(1)
    expect(dialogEntries[0]!.open).toBe(true)

    closeDialog(dialogEntries[0]!.id, 'two')
    await expect(second).resolves.toBe('two')
  })

  it('carries persistent and width through to the entry', () => {
    useDialog().openDialog(Stub, {}, { persistent: true, width: 'lg' })

    expect(dialogEntries[0]!.opts.persistent).toBe(true)
    expect(dialogEntries[0]!.opts.width).toBe('lg')
  })
})

describe('focus', () => {
  /** After the task the focus comes back in. */
  const handedBack = () => new Promise(resolve => setTimeout(resolve))

  // The host renders no activator, so Vuetify has nothing to give it back to.
  it('goes back to what had it when the dialog opened', async () => {
    const button = document.createElement('button')
    document.body.append(button)
    button.focus()
    void useDialog().openDialog(Stub)
    button.blur()

    closeDialog(dialogEntries[0]!.id)
    await handedBack()

    expect(document.activeElement).toBe(button)
    button.remove()
  })

  // A script focus matches :focus-visible and Vuetify opens a tooltip on it, so
  // the ring comes back only for a keyboard open.
  it.each([
    ['keydown', true],
    ['pointerdown', false],
  ])('comes back with the focus ring only when opened from the keyboard, whatever ring the opener had (%s)', async (press, ring) => {
    const button = document.createElement('button')
    document.body.append(button)
    button.focus()
    vi.spyOn(button, 'matches').mockImplementation(selector => !ring && selector === ':focus-visible')
    const focus = vi.spyOn(button, 'focus')
    button.dispatchEvent(new Event(press, { bubbles: true }))
    void useDialog().openDialog(Stub)
    button.blur()
    window.dispatchEvent(new Event(ring ? 'pointerdown' : 'keydown'))

    closeDialog(dialogEntries[0]!.id)
    await handedBack()

    expect(focus).toHaveBeenLastCalledWith({ preventScroll: true, focusVisible: ring })
    button.remove()
  })

  // WebKit rings whatever holds the focus after an unhandled keydown.
  it('comes back only after the event that closed the dialog', async () => {
    const button = document.createElement('button')
    document.body.append(button)
    button.focus()
    void useDialog().openDialog(Stub)
    button.blur()

    closeDialog(dialogEntries[0]!.id)
    await nextTick()
    expect(document.activeElement).not.toBe(button)

    await handedBack()
    expect(document.activeElement).toBe(button)
    button.remove()
  })

  it('comes back from the dialog\'s own field still holding it a task later', async () => {
    const button = document.createElement('button')
    const field = document.createElement('input')
    document.body.append(button, field)
    button.focus()
    void useDialog().openDialog(Stub)
    field.focus()

    closeDialog(dialogEntries[0]!.id)
    await handedBack()

    expect(document.activeElement).toBe(button)
    button.remove()
    field.remove()
  })

  // The app may move the focus once the dialog resolves.
  it('leaves the focus where the app moved it after the dialog closed', async () => {
    const button = document.createElement('button')
    const field = document.createElement('input')
    const row = document.createElement('div')
    row.tabIndex = 0
    document.body.append(button, field, row)
    button.focus()
    void useDialog().openDialog(Stub)
    field.focus()

    closeDialog(dialogEntries[0]!.id)
    row.focus()
    await handedBack()

    expect(document.activeElement).toBe(row)
    button.remove()
    field.remove()
    row.remove()
  })

  it('stays put when what had it is gone', async () => {
    const button = document.createElement('button')
    document.body.append(button)
    button.focus()
    void useDialog().openDialog(Stub)
    button.remove()

    closeDialog(dialogEntries[0]!.id)
    await handedBack()

    expect(document.activeElement).not.toBe(button)
  })
})

describe('close injection', () => {
  // A dialog gets its resolver by injection and never learns its own id.
  it('is a no-op outside a dialog rather than throwing', () => {
    const { close } = inComponent(() => useDialog())
    expect(() => close()).not.toThrow()
  })

  it('is a no-op outside a component context', () => {
    expect(() => useDialog().close()).not.toThrow()
  })
})

describe('presets', () => {
  it('confirm resolves true only when closed with true', async () => {
    registerDialogPresets(Stub, Stub)
    const { confirm } = useDialog()

    const yes = confirm({ title: 'ok?' })
    closeDialog(dialogEntries[0]!.id, true)
    await expect(yes).resolves.toBe(true)

    const dismissed = confirm({ title: 'ok?' })
    closeDialog(dialogEntries[0]!.id) // backdrop or escape
    await expect(dismissed).resolves.toBe(false)
  })

  it('prompt resolves the string, and undefined when cancelled', async () => {
    registerDialogPresets(Stub, Stub)
    const { prompt } = useDialog()

    const answered = prompt({ title: 'name?' })
    closeDialog(dialogEntries[0]!.id, 'a name')
    await expect(answered).resolves.toBe('a name')

    const cancelled = prompt({ title: 'name?' })
    closeDialog(dialogEntries[0]!.id)
    await expect(cancelled).resolves.toBeUndefined()
  })

  // An empty string is a real answer and resolves as ''.
  it('prompt distinguishes an empty answer from a cancel', async () => {
    registerDialogPresets(Stub, Stub)
    const promise = useDialog().prompt({ title: 'name?' })

    closeDialog(dialogEntries[0]!.id, '')
    await expect(promise).resolves.toBe('')
  })

  it('passes the options through to the preset component', () => {
    registerDialogPresets(Stub, Stub)
    void useDialog().confirm({ title: 'Delete?', confirmColor: 'error' })

    expect(dialogEntries[0]!.props.options).toMatchObject({
      title: 'Delete?',
      confirmColor: 'error',
    })
  })
})

describe('component identity', () => {
  // markRaw, so Vue does not deep-proxy a component definition.
  it('stores the component untouched', () => {
    useDialog().openDialog(Stub)
    expect(dialogEntries[0]!.component).toBe(Stub)
  })
})

describe('unregistered presets', () => {
  // Without the plugin, opening throws.
  it('throws rather than opening nothing', async () => {
    vi.resetModules()
    const fresh = await import('../src/composables/useDialog')

    expect(() => fresh.useDialog().confirm({ title: 'x' }))
      .toThrow(/presets are not registered/)
  })
})
