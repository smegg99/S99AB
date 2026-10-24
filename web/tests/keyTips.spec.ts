// web/tests/keyTips.spec.ts
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { useKeyTips } from '../src/composables/primitives/useKeyTips'

const pointer = (buttons = 0) => ({ buttons }) as PointerEvent
const focus = (visible: boolean) => ({ target: { matches: () => visible } }) as unknown as FocusEvent

describe('a bar key\'s tooltip', () => {
  beforeEach(() => {
    vi.stubGlobal('document', { activeElement: null, querySelector: () => null, getElementById: () => null })
  })

  afterEach(() => {
    vi.useRealTimers()
    vi.unstubAllGlobals()
  })

  it('opens on hover and closes on leaving, a press or a click', () => {
    const tips = useKeyTips()
    const undo = tips.on('undo')
    undo.pointerenter(pointer())
    expect(tips.shown('undo')).toBe(true)
    undo.pointerdown()
    expect(tips.shown('undo')).toBe(false)
    undo.pointerenter(pointer())
    undo.click()
    expect(tips.shown('undo')).toBe(false)
    undo.pointerenter(pointer())
    undo.pointerleave()
    expect(tips.shown('undo')).toBe(false)
  })

  it('opens on keyboard focus only, so a clicked key keeps no tooltip', () => {
    const tips = useKeyTips()
    const part = tips.on('school')
    part.focus(focus(false))
    expect(tips.shown('school')).toBe(false)
    part.focus(focus(true))
    expect(tips.shown('school')).toBe(true)
  })

  // Closed inside the blur, the tooltip would hand the focus back to its key
  // (Vuetify's VOverlay) and WebKit would drop the move: Tab stayed put.
  it('closes on blur only once the focus has moved on', () => {
    vi.useFakeTimers()
    const tips = useKeyTips()
    const school = tips.on('school')
    school.focus(focus(true))
    school.blur()
    expect(tips.shown('school')).toBe(true)
    vi.runAllTimers()
    expect(tips.shown('school')).toBe(false)
    school.focus(focus(true))
    school.blur()
    tips.on('lessons').focus(focus(true))
    vi.runAllTimers()
    expect(tips.shown('school')).toBe(false)
    expect(tips.shown('lessons')).toBe(true)
  })

  it('keeps one open at a time, none while a button is held, and closes on demand', () => {
    const tips = useKeyTips()
    tips.on('undo').pointerenter(pointer())
    tips.on('redo').pointerenter(pointer())
    expect(tips.shown('undo')).toBe(false)
    expect(tips.shown('redo')).toBe(true)
    tips.on('undo').pointerleave()
    expect(tips.shown('redo')).toBe(true)
    tips.close()
    expect(tips.shown('redo')).toBe(false)
    tips.on('undo').pointerenter(pointer(1))
    expect(tips.shown('undo')).toBe(false)
  })

  // S99AB's DisabledHint names its tooltip in aria-describedby; Vuetify
  // marks the open one's overlay v-overlay--active.
  const hinted = { matches: (selector: string) => selector === '.s99ab-disabled-hint--disabled:focus-visible', getAttribute: () => 'v-tooltip-7' }
  const overlay = (open: boolean) => ({ classList: { contains: (name: string) => open && name === 'v-overlay--active' } })

  it('opens none on hover while a disabled key has the keyboard focus and shows its reason', () => {
    const tips = useKeyTips()
    vi.stubGlobal('document', { activeElement: hinted, querySelector: () => null, getElementById: (id: string) => (id === 'v-tooltip-7' ? overlay(true) : null) })
    tips.on('redo').pointerenter(pointer())
    expect(tips.shown('redo')).toBe(false)
    vi.stubGlobal('document', { activeElement: { matches: () => false, getAttribute: () => null }, querySelector: () => null, getElementById: () => null })
    tips.on('redo').pointerenter(pointer())
    expect(tips.shown('redo')).toBe(true)
  })

  // Escape, or a reason that changes, closes S99AB's tooltip while the focus
  // stays on the disabled key: hover opens the bar's tooltips again.
  it('opens on hover again once the focused disabled key\'s reason has closed', () => {
    const tips = useKeyTips()
    vi.stubGlobal('document', { activeElement: hinted, querySelector: () => null, getElementById: () => overlay(false) })
    tips.on('rating').pointerenter(pointer())
    expect(tips.shown('rating')).toBe(true)
    tips.close()
    vi.stubGlobal('document', { activeElement: hinted, querySelector: () => null, getElementById: () => null })
    tips.on('rating').pointerenter(pointer())
    expect(tips.shown('rating')).toBe(true)
  })

  it('opens none on keyboard focus while the pointer rests on a disabled key', () => {
    const tips = useKeyTips()
    vi.stubGlobal('document', { activeElement: null, querySelector: (selector: string) => (selector === '.s99ab-disabled-hint--disabled:hover' ? {} : null), getElementById: () => null })
    tips.on('school').focus(focus(true))
    expect(tips.shown('school')).toBe(false)
    vi.stubGlobal('document', { activeElement: null, querySelector: () => null, getElementById: () => null })
    tips.on('school').focus(focus(true))
    expect(tips.shown('school')).toBe(true)
  })
})
