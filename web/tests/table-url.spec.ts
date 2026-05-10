// web/tests/table-url.spec.ts

import { nextTick } from 'vue'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import {
  registerTableRouter,
  type TableRouter,
  useTableState,
} from '../src/composables/table/useServerTable'

beforeEach(() => {
  registerTableRouter(() => undefined)
  vi.useFakeTimers()
})

afterEach(() => {
  vi.useRealTimers()
})

async function settle(ms = 300) {
  await nextTick()
  vi.advanceTimersByTime(ms)
  await nextTick()
  await nextTick()
}

/** Records what the table wrote, in place of vue-router. */
function fakeRouter(query: Record<string, string | undefined> = {}): TableRouter {
  const router: TableRouter = {
    query: { ...query },
    replace: (next) => {
      router.query = { ...next }
    },
  }
  return router
}

describe('url sync', () => {
  it('is off unless asked for', async () => {
    const router = fakeRouter()
    registerTableRouter(() => router)

    const t = useTableState({ key: ['x'] })
    t.page.value = 3
    await settle()

    expect(router.query).toEqual({})
  })

  it('writes page, limit, sort and search', async () => {
    const router = fakeRouter()
    registerTableRouter(() => router)

    const t = useTableState({ key: ['x'], syncUrl: true })
    t.page.value = 4
    await settle()
    expect(router.query.page).toBe('4')

    t.limit.value = 50
    await settle()
    expect(router.query.limit).toBe('50')

    t.sortBy.value = [{ key: 'name', order: 'desc' }]
    await settle()
    expect(router.query.sort).toBe('-name')

    t.search.value = 'widget'
    await settle()
    expect(router.query.q).toBe('widget')
  })

  // Defaults stay out of the URL.
  it('omits defaults', async () => {
    const router = fakeRouter()
    registerTableRouter(() => router)

    const t = useTableState({ key: ['x'], syncUrl: true, limit: 25 })
    t.page.value = 2
    await settle()
    t.page.value = 1
    await settle()

    expect(router.query.page).toBeUndefined()
    expect(router.query.limit).toBeUndefined()
    expect(router.query.sort).toBeUndefined()
    expect(router.query.q).toBeUndefined()
  })

  // A refresh or shared link restores the same view.
  it('restores state from the query on load', () => {
    registerTableRouter(() => fakeRouter({
      page: '3',
      limit: '50',
      sort: '-name,status',
      q: 'widget',
    }))

    const t = useTableState({ key: ['x'], syncUrl: true })

    expect(t.page.value).toBe(3)
    expect(t.limit.value).toBe(50)
    expect(t.sortBy.value).toEqual([
      { key: 'name', order: 'desc' },
      { key: 'status', order: 'asc' },
    ])
    expect(t.params.value.search).toBe('widget')
  })

  // A stale bookmark falls back to the default.
  it('ignores an unparseable page or limit', () => {
    registerTableRouter(() => fakeRouter({ page: 'abc', limit: '' }))

    const t = useTableState({ key: ['x'], syncUrl: true, limit: 25 })

    expect(t.page.value).toBe(1)
    expect(t.limit.value).toBe(25)
  })

  // Lets two tables share a page.
  it('prefixes the parameters when asked', async () => {
    const router = fakeRouter()
    registerTableRouter(() => router)

    const t = useTableState({ key: ['x'], syncUrl: true, urlPrefix: 'left' })
    t.page.value = 2
    await settle()

    expect(router.query.left_page).toBe('2')
    expect(router.query.page).toBeUndefined()
  })

  it('reads a prefixed query back', () => {
    registerTableRouter(() => fakeRouter({ left_page: '5', left_q: 'thing' }))

    const t = useTableState({ key: ['x'], syncUrl: true, urlPrefix: 'left' })

    expect(t.page.value).toBe(5)
    expect(t.params.value.search).toBe('thing')
  })

  it('preserves unrelated query parameters', async () => {
    const router = fakeRouter({ tab: 'details' })
    registerTableRouter(() => router)

    const t = useTableState({ key: ['x'], syncUrl: true })
    t.page.value = 2
    await settle()

    expect(router.query.tab).toBe('details')
    expect(router.query.page).toBe('2')
  })

  // Works without a router, as in a Wails window or a test.
  it('works with no router registered', async () => {
    registerTableRouter(() => undefined)

    const t = useTableState({ key: ['x'], syncUrl: true })
    t.page.value = 2
    await settle()

    expect(t.params.value.page).toBe(2)
  })
})
