// web/tests/listUndo.spec.ts
import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import { effectScope, nextTick, ref } from 'vue'
import { pendingSaves, useListUndo } from '../src/composables/primitives/useListUndo'

// Vuetify keeps a focused list's text, so after Ctrl+Z the list is blurred and focused again once the change is drawn.

/** A list's input as the composable reads it: shut, focused or not. */
function list() {
  const el = {
    getAttribute: (name: string) => (name === 'aria-expanded' ? 'false' : null),
    closest: () => el,
    blur: vi.fn(() => (focused = null)),
    focus: vi.fn(() => (focused = el)),
  }
  return el
}

let focused: unknown = null
/** What the editor's shortcut heard. */
let heard: number

beforeEach(() => {
  focused = null
  heard = 0
  vi.stubGlobal('document', { get activeElement() {
    return focused
  } })
  vi.stubGlobal('KeyboardEvent', class extends Event {})
})
afterEach(() => vi.unstubAllGlobals())

/** Ctrl+Z pressed in a list, its host handing the key on to the shortcut. */
function ctrlZ(target: unknown) {
  const host = new EventTarget()
  host.addEventListener('keydown', () => heard++)
  return { key: 'z', ctrlKey: true, metaKey: false, altKey: false, shiftKey: false, target, currentTarget: { parentElement: host }, preventDefault: vi.fn(), stopPropagation: vi.fn() } as unknown as KeyboardEvent
}

const settle = async () => {
  for (let i = 0; i < 6; i++) await nextTick()
}

it('lets the list go and focuses it again once the step\'s change comes, after the save\'s own', async () => {
  const scope = effectScope()
  const lesson = ref(1)
  let saved = () => {}
  const saving = new Promise<void>(resolve => (saved = resolve))
  const el = list()
  focused = el
  const key = scope.run(() => useListUndo(() => saving, () => lesson.value))!
  key(ctrlZ(el))
  // The save lands and is drawn: not the step's change yet.
  lesson.value = 2
  saved()
  await settle()
  expect(heard).toBe(1)
  expect(el.blur).not.toHaveBeenCalled()
  // The undo lands.
  lesson.value = 3
  await settle()
  expect(el.blur).toHaveBeenCalledOnce()
  expect(el.focus).toHaveBeenCalledWith({ preventScroll: true })
  expect(focused).toBe(el)
  // Only once.
  lesson.value = 4
  await settle()
  expect(el.blur).toHaveBeenCalledOnce()
  scope.stop()
})

it('leaves a list alone that lost the focus meanwhile', async () => {
  const scope = effectScope()
  const lesson = ref(1)
  const el = list()
  focused = el
  const key = scope.run(() => useListUndo(() => Promise.resolve(), () => lesson.value))!
  key(ctrlZ(el))
  await settle()
  focused = null
  lesson.value = 2
  await settle()
  expect(el.blur).not.toHaveBeenCalled()
  expect(el.focus).not.toHaveBeenCalled()
  scope.stop()
})

// Panes with lists other than a lesson's hand Ctrl+Z on once the pane's saves have landed.
it('waits for every save a pane started, refused ones included, and no longer', async () => {
  const saves = pendingSaves()
  let done = false
  void saves.settled().then(() => (done = true))
  await settle()
  expect(done).toBe(true)

  let land = () => {}
  let refuse = (_: Error) => {}
  const first = saves.track(new Promise<void>(resolve => (land = resolve)))
  const second = saves.track(new Promise<void>((_, reject) => (refuse = reject)))
  second.catch(() => {})
  done = false
  void saves.settled().then(() => (done = true))
  land()
  await first
  await settle()
  expect(done).toBe(false)
  refuse(new Error('refused'))
  await settle()
  expect(done).toBe(true)
})
