// web/tests/table.spec.ts

import { nextTick } from 'vue'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import {
  decodeSort,
  encodeSort,
  registerTableRouter,
  useTableState,
} from '../src/composables/table/useServerTable'

beforeEach(() => {
  registerTableRouter(() => undefined)
  vi.useFakeTimers()
})

afterEach(() => {
  vi.useRealTimers()
})

/** Advances past the debounce. Ticks first, because the watcher creates the timeout on the next tick. */
async function settle(ms = 300) {
  await nextTick()
  vi.advanceTimersByTime(ms)
  await nextTick()
  await nextTick()
}

describe('sort encoding', () => {
  it('encodes ascending and descending the way the contract specifies', () => {
    expect(encodeSort([{ key: 'name', order: 'asc' }])).toBe('name')
    expect(encodeSort([{ key: 'created_at', order: 'desc' }])).toBe('-created_at')
    expect(encodeSort([
      { key: 'name', order: 'asc' },
      { key: 'created_at', order: 'desc' },
    ])).toBe('name,-created_at')
  })

  it('encodes an absent order as ascending', () => {
    expect(encodeSort([{ key: 'name' }])).toBe('name')
  })

  it('round-trips', () => {
    const sort = 'name,-created_at'
    expect(encodeSort(decodeSort(sort))).toBe(sort)
  })

  it('ignores blanks and whitespace when decoding', () => {
    expect(decodeSort(' name , , -created_at ')).toEqual([
      { key: 'name', order: 'asc' },
      { key: 'created_at', order: 'desc' },
    ])
    expect(decodeSort('')).toEqual([])
  })
})

describe('defaults', () => {
  it('starts on page 1 with the configured limit', () => {
    const t = useTableState({ key: ['items'], limit: 50 })

    expect(t.params.value).toEqual({ page: 1, limit: 50, sort: '', search: '' })
  })

  it('defaults the limit to 25', () => {
    expect(useTableState({ key: ['items'] }).limit.value).toBe(25)
  })
})

describe('search debounce', () => {
  // No request per keystroke.
  it('does not reach the params until the debounce elapses', async () => {
    const t = useTableState({ key: ['items'] })

    t.search.value = 'smi'
    await nextTick()
    expect(t.params.value.search).toBe('')

    await settle()
    expect(t.params.value.search).toBe('smi')
  })

  it('collapses rapid typing into one change', async () => {
    const t = useTableState({ key: ['items'] })

    for (const value of ['s', 'sm', 'smi', 'smit', 'smith']) {
      t.search.value = value
      vi.advanceTimersByTime(100)
      await nextTick()
    }
    expect(t.params.value.search).toBe('')

    await settle()
    expect(t.params.value.search).toBe('smith')
  })

  it('honours a custom debounce', async () => {
    const t = useTableState({ key: ['items'], searchDebounce: 50 })

    t.search.value = 'x'
    await settle(50)
    expect(t.params.value.search).toBe('x')
  })
})

describe('page resets', () => {
  // A new search starts at page 1.
  it('resets to page 1 when the search changes', async () => {
    const t = useTableState({ key: ['items'] })
    t.page.value = 7
    await nextTick()

    t.search.value = 'smith'
    await settle()

    expect(t.page.value).toBe(1)
  })

  it('resets to page 1 when the page size changes', async () => {
    const t = useTableState({ key: ['items'] })
    t.page.value = 7
    await nextTick()

    t.limit.value = 50
    await nextTick()

    expect(t.page.value).toBe(1)
  })

  it('resets to page 1 when the sort changes', async () => {
    const t = useTableState({ key: ['items'] })
    t.page.value = 7
    await nextTick()

    t.sortBy.value = [{ key: 'name', order: 'asc' }]
    await nextTick()

    expect(t.page.value).toBe(1)
  })

  it('does not reset when only the page changes', async () => {
    const t = useTableState({ key: ['items'] })
    t.page.value = 3
    await nextTick()

    expect(t.page.value).toBe(3)
  })
})

describe('onOptions', () => {
  it('applies a page change from Vuetify', async () => {
    const t = useTableState({ key: ['items'] })
    t.onOptions({ page: 4, itemsPerPage: 25, sortBy: [] })
    await nextTick()

    expect(t.page.value).toBe(4)
  })

  it('applies a sort change', async () => {
    const t = useTableState({ key: ['items'] })
    t.onOptions({ page: 1, itemsPerPage: 25, sortBy: [{ key: 'name', order: 'desc' }] })
    await nextTick()

    expect(t.params.value.sort).toBe('-name')
  })

  // Vuetify sends its current page with a new sort; the page is applied last so
  // a page-only change keeps the requested page.
  it('keeps page 1 when a sort change arrives with a stale page', async () => {
    const t = useTableState({ key: ['items'] })
    t.page.value = 5
    await nextTick()

    t.onOptions({ page: 5, itemsPerPage: 25, sortBy: [{ key: 'name', order: 'asc' }] })
    await nextTick()

    expect(t.page.value).toBe(1)
  })

  it('ignores a payload that changes nothing', async () => {
    const t = useTableState({ key: ['items'] })
    t.page.value = 3
    await nextTick()

    t.onOptions({ page: 3, itemsPerPage: 25, sortBy: [] })
    await nextTick()

    expect(t.page.value).toBe(3)
  })
})

describe('reset', () => {
  it('returns everything to its default', async () => {
    const t = useTableState({ key: ['items'], limit: 10 })
    t.page.value = 4
    t.limit.value = 50
    t.sortBy.value = [{ key: 'name', order: 'desc' }]
    t.search.value = 'smith'
    await settle()

    t.reset()
    await nextTick()

    expect(t.params.value).toEqual({ page: 1, limit: 10, sort: '', search: '' })
  })
})
