// web/tests/treeKeys.spec.ts
import { ref } from 'vue'
import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import { useTreeKeys } from '../src/composables/primitives/useTreeKeys'

/** A tree's rows as the keys read them: their ids, nothing folding. */
function tree(...ids: string[]) {
  const rows = ids.map(node => ({ dataset: { node } as Record<string, string | undefined> }))
  return ref({ dataset: {}, querySelectorAll: () => rows, querySelector: () => null, addEventListener: () => {} } as unknown as HTMLElement)
}

/** A key pressed on the focused row; whether the tree took it. */
function press(keys: ReturnType<typeof useTreeKeys>, key: string, held: Partial<KeyboardEvent> = {}): boolean {
  const event = { key, altKey: false, ctrlKey: false, metaKey: false, shiftKey: false, ...held, preventDefault: vi.fn() }
  keys.onKey(event as unknown as KeyboardEvent)
  return event.preventDefault.mock.calls.length > 0
}

beforeEach(() => vi.stubGlobal('CSS', { escape: (id: string) => id }))
afterEach(() => vi.unstubAllGlobals())

it('walks a row down and up on the arrows, and with Ctrl held', () => {
  const keys = useTreeKeys(tree('1a', '1b', '1c'), () => false, () => {}, '1a')
  expect(press(keys, 'ArrowDown')).toBe(true)
  expect(keys.focus.value).toBe('1b')
  expect(press(keys, 'ArrowUp', { ctrlKey: true })).toBe(true)
  expect(keys.focus.value).toBe('1a')
})

// Alt+arrows belong to the workspace shortcuts; a tree that took them would move twice.
it.each(['ArrowDown', 'ArrowUp', 'ArrowLeft', 'ArrowRight', 'Home', 'End'])('leaves Alt+%s to the workspace\'s shortcuts, the tree walked by keys', (key) => {
  const toggle = vi.fn()
  const root = tree('1a', '1b', '1c')
  const keys = useTreeKeys(root, () => true, toggle, '1b')
  expect(press(keys, key, { altKey: true })).toBe(false)
  expect(keys.focus.value).toBe('1b')
  expect(toggle).not.toHaveBeenCalled()
  // So the row the shortcut's pick moves the focus to (kit/Tree.vue) is ringed.
  expect(root.value.dataset.s99abKeyed).toBe('')
})
