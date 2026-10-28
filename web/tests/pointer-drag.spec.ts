// web/tests/pointer-drag.spec.ts
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { effectScope } from 'vue'
import { createPointerDrag, type DropPlace } from '../src/composables/primitives/internal/pointerDrag'

interface Carried { kind: string, id: number, title: string, line: string }
const DRAG_START = 5

/** The window the drag listens on, and the element "under the pointer". */
let win: EventTarget
let under: { zone: string } | null
/** The classes on the document's root. */
let root: Set<string>

beforeEach(() => {
  win = new EventTarget()
  under = null
  root = new Set()
  vi.stubGlobal('window', win)
  vi.stubGlobal('document', { elementFromPoint: () => under, documentElement: { classList: { add: (name: string) => root.add(name), remove: (name: string) => root.delete(name) } } })
  vi.useFakeTimers()
})

afterEach(() => {
  vi.useRealTimers()
  vi.unstubAllGlobals()
})

const lesson: Carried = { kind: 'lesson', id: 7, title: 'Matematyka', line: 'Kowalska' }
const press = (x = 0, y = 0) => ({ button: 0, clientX: x, clientY: y }) as PointerEvent
const send = (type: string, props: Record<string, unknown> = {}) => win.dispatchEvent(Object.assign(new Event(type), props))
/** A move with the main button held, as every move of a drag is. */
const moveTo = (x: number, y = 0) => send('pointermove', { clientX: x, clientY: y, buttons: 1 })

/** A drop place over elements of one zone, taking one kind, that records what happens to it. */
function zone(name: string, kind = 'lesson') {
  const seen = { begun: 0, ended: 0, landed: [] as [number, string][] }
  const place: DropPlace<string, Carried> = {
    find: el => ((el as unknown as { zone: string }).zone === name ? name : null),
    takes: carried => carried.kind === kind,
    say: (carried, at) => `${carried.title} -> ${at}`,
    begin: () => seen.begun++,
    end: () => seen.ended++,
    land: (carried, at) => seen.landed.push([carried.id, at]),
  }
  return { place, seen }
}

function setup() {
  const scope = effectScope()
  const drag = scope.run(() => createPointerDrag<Carried>())!
  return { drag, scope }
}

describe('a thing carried by the pointer', () => {
  it('stays a click until the pointer has moved far enough, and then is carried', () => {
    const { drag, scope } = setup()
    drag.grab(lesson, press())
    moveTo(DRAG_START - 1)
    expect(drag.state.carried).toBeNull()
    send('pointerup')
    expect(drag.dragged()).toBe(false)
    drag.grab(lesson, press())
    moveTo(DRAG_START)
    expect(drag.state.carried).toEqual(lesson)
    scope.stop()
  })

  it('lands where the place under the pointer takes it, passing over one that does not, and says what the drop does', () => {
    const { drag, scope } = setup()
    const week = zone('week')
    const palette = zone('week', 'subject')
    scope.run(() => {
      drag.place('week', week.place)
      drag.place('palette', palette.place)
    })
    drag.grab(lesson, press())
    under = { zone: 'week' }
    moveTo(20)
    expect(week.seen.begun).toBe(1)
    expect(drag.state.over).toEqual({ name: 'week', at: 'week' })
    expect(drag.say.value).toBe('Matematyka -> week')
    send('pointerup')
    expect(week.seen.landed).toEqual([[7, 'week']])
    expect(palette.seen.landed).toEqual([])
    expect(week.seen.ended).toBe(1)
    expect(drag.state.carried).toBeNull()
    expect(drag.dragged()).toBe(true)
    vi.runAllTimers()
    expect(drag.dragged()).toBe(false)
    scope.stop()
  })

  it('lands nowhere outside every place, and Escape puts it down where it was', () => {
    const { drag, scope } = setup()
    const week = zone('week')
    scope.run(() => drag.place('week', week.place))
    drag.grab(lesson, press())
    under = { zone: 'tree' }
    moveTo(20)
    expect(drag.state.over).toBeNull()
    expect(drag.say.value).toBe('')
    send('pointerup')
    expect(week.seen.landed).toEqual([])
    drag.grab(lesson, press())
    under = { zone: 'week' }
    moveTo(20)
    send('keydown', { key: 'Escape' })
    expect(drag.state.carried).toBeNull()
    send('pointerup')
    expect(week.seen.landed).toEqual([])
    expect(week.seen.ended).toBe(2)
    scope.stop()
  })

  it('says once why a held thing cannot be carried, and its release is no click', () => {
    const { drag, scope } = setup()
    const refuse = vi.fn()
    drag.hold(refuse, press())
    moveTo(DRAG_START)
    moveTo(DRAG_START * 3)
    expect(refuse).toHaveBeenCalledTimes(1)
    expect(drag.state.held).toBe(true)
    send('pointerup')
    expect(drag.state.held).toBe(false)
    expect(drag.dragged()).toBe(true)
    scope.stop()
  })

  it('puts it down, landing nowhere, at a move with no button held after a release outside the window', () => {
    const { drag, scope } = setup()
    const week = zone('week')
    scope.run(() => drag.place('week', week.place))
    drag.grab(lesson, press())
    under = { zone: 'week' }
    moveTo(20)
    send('pointermove', { clientX: 30, clientY: 0, buttons: 0 })
    expect(drag.state.carried).toBeNull()
    expect(drag.state.over).toBeNull()
    expect(week.seen.ended).toBe(1)
    send('pointerup')
    expect(week.seen.landed).toEqual([])
    scope.stop()
  })

  it('keeps the fields out of the pointer\'s way while a press is held, through a drag, until its end', () => {
    const { drag, scope } = setup()
    drag.grab(lesson, press())
    expect(root.has('s99ab-pressing')).toBe(true)
    moveTo(DRAG_START)
    expect(root.has('s99ab-pressing')).toBe(true)
    send('pointerup')
    expect(root.has('s99ab-pressing')).toBe(false)
    drag.hold(() => {}, press())
    expect(root.has('s99ab-pressing')).toBe(true)
    send('blur')
    expect(root.has('s99ab-pressing')).toBe(false)
    scope.stop()
  })

  it('forgets a place when the scope that registered it ends', () => {
    const { drag, scope } = setup()
    const week = zone('week')
    const part = effectScope()
    part.run(() => drag.place('week', week.place))
    part.stop()
    drag.grab(lesson, press())
    under = { zone: 'week' }
    moveTo(20)
    expect(drag.state.over).toBeNull()
    expect(week.seen.begun).toBe(0)
    scope.stop()
  })
})
