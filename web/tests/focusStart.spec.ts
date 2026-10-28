// web/tests/focusStart.spec.ts
import { effectScope, ref } from 'vue'
import { describe, expect, it } from 'vitest'
import { useFocusGroup } from '../src/composables/primitives/useFocusGroup'
import { focusStart } from '../src/browser/focus'

interface Fake {
  parent: Fake | null
  moves: string[]
  isContentEditable: boolean
  ownerDocument: { body: Fake } | null
  contains: (node: unknown) => boolean
  blur: () => void
  focus: () => void
}

function node(parent: Fake | null = null, editable = false): Fake {
  const self: Fake = {
    parent,
    moves: [],
    isContentEditable: editable,
    ownerDocument: null,
    contains(other) {
      for (let at = other as Fake | null; at; at = at.parent) if (at === self) return true
      return false
    },
    blur: () => self.moves.push('blur'),
    focus: () => self.moves.push('focus'),
  }
  return self
}

const press = (target: Fake) => ({ target }) as unknown as MouseEvent
const focusIn = (target: Fake) => ({ target }) as unknown as FocusEvent
function key(target: Fake, init: Partial<KeyboardEvent> = {}) {
  return { target, code: 'Tab', key: 'Unidentified', shiftKey: true, ctrlKey: false, altKey: false, metaKey: false, defaultPrevented: false, ...init } as unknown as KeyboardEvent
}

describe('Shift+Tab from a clicked control', () => {
  it('restarts from the control when the press landed inside it', () => {
    const start = focusStart()
    const control = node()
    const glyph = node(control)
    start.mousedown(press(glyph))
    start.focusin(focusIn(control))
    start.keydown(key(control))
    expect(control.moves).toEqual(['blur', 'focus'])
    // Once is enough: the focus moved off the glyph.
    control.moves = []
    start.keydown(key(control))
    expect(control.moves).toEqual([])
  })

  it('takes Tab named as such too, and leaves forward Tab and other keys alone', () => {
    const start = focusStart()
    const control = node()
    const glyph = node(control)
    start.mousedown(press(glyph))
    start.keydown(key(control, { shiftKey: false }))
    start.keydown(key(control, { code: 'KeyA', key: 'A' }))
    start.keydown(key(control, { ctrlKey: true }))
    start.keydown(key(control, { defaultPrevented: true }))
    expect(control.moves).toEqual([])
    start.keydown(key(control, { code: '', key: 'Tab' }))
    expect(control.moves).toEqual(['blur', 'focus'])
  })

  it('does nothing when the press landed on the control itself, an editable control or nothing focused', () => {
    const start = focusStart()
    const field = node()
    start.mousedown(press(field))
    start.keydown(key(field))
    expect(field.moves).toEqual([])

    const editor = node(null, true)
    start.mousedown(press(node(editor)))
    start.keydown(key(editor))
    expect(editor.moves).toEqual([])

    const body = node()
    body.ownerDocument = { body }
    start.mousedown(press(node(body)))
    start.keydown(key(body))
    expect(body.moves).toEqual([])
  })

  it('forgets the press once the focus moved to a control that does not hold it', () => {
    const start = focusStart()
    const first = node()
    const glyph = node(first)
    start.mousedown(press(glyph))
    start.focusin(focusIn(first))
    start.focusin(focusIn(node()))
    start.focusin(focusIn(first))
    start.keydown(key(first))
    expect(first.moves).toEqual([])
  })
})

describe('programmatic keyboard focus', () => {
  it('keeps the ring until a pointer press, explicit clear or scope disposal', () => {
    const root = document.createElement('div')
    const scope = effectScope()
    const ring = scope.run(() => useFocusGroup(ref(root)))!
    ring.mark()
    expect(root.dataset.s99abKeyed).toBe('')
    root.dispatchEvent(new Event('pointerdown'))
    expect(root.dataset.s99abKeyed).toBeUndefined()
    ring.mark()
    ring.mark(false)
    expect(root.dataset.s99abKeyed).toBeUndefined()
    ring.mark()
    scope.stop()
    expect(root.dataset.s99abKeyed).toBeUndefined()
  })

  it('normalizes physical Tab before dependency handlers, without replacing the event', () => {
    const event = new KeyboardEvent('keydown', { key: 'Unidentified', code: 'Tab', shiftKey: true, cancelable: true })
    focusStart().keydown(event)
    expect(event.key).toBe('Tab')
    expect(event.shiftKey).toBe(true)
    expect(event.defaultPrevented).toBe(false)
    const other = new KeyboardEvent('keydown', { key: 'Unidentified', code: 'KeyA' })
    focusStart().keydown(other)
    expect(other.key).toBe('Unidentified')
  })
})
