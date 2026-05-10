// web/tests/eventsource.spec.ts

import { effectScope, ref } from 'vue'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import {
  configureEventSource,
  useEventSource,
  useEventSourceConfig,
} from '../src/composables/useEventSource'

// happy-dom has no EventSource, so the tests supply one they control.
class FakeEventSource {
  static CONNECTING = 0
  static OPEN = 1
  static CLOSED = 2

  static instances: FakeEventSource[] = []

  url: string
  withCredentials: boolean
  readyState = FakeEventSource.CONNECTING
  onopen: (() => void) | null = null
  onmessage: ((ev: MessageEvent) => void) | null = null
  onerror: ((ev: Event) => void) | null = null
  listeners: Record<string, (ev: MessageEvent) => void> = {}

  constructor(url: string, init?: { withCredentials?: boolean }) {
    this.url = url
    this.withCredentials = init?.withCredentials ?? false
    FakeEventSource.instances.push(this)
  }

  addEventListener(name: string, fn: (ev: MessageEvent) => void) {
    this.listeners[name] = fn
  }

  close() {
    this.readyState = FakeEventSource.CLOSED
  }

  // Test controls.
  emitOpen() {
    this.readyState = FakeEventSource.OPEN
    this.onopen?.()
  }

  emitMessage(data: string) {
    this.onmessage?.({ data } as MessageEvent)
  }

  emitNamed(name: string, data: string) {
    this.listeners[name]?.({ data } as MessageEvent)
  }

  emitError(closed: boolean) {
    this.readyState = closed ? FakeEventSource.CLOSED : FakeEventSource.CONNECTING
    this.onerror?.(new Event('error'))
  }
}

function inScope<T>(fn: () => T): { value: T, stop: () => void } {
  const scope = effectScope()
  const value = scope.run(fn)!
  return { value, stop: () => scope.stop() }
}

const last = () => FakeEventSource.instances.at(-1)!

describe('useEventSource', () => {
  beforeEach(() => {
    FakeEventSource.instances = []
    vi.stubGlobal('EventSource', FakeEventSource)
    configureEventSource({ withCredentials: true, reconnect: { delay: 1000, maxDelay: 15000, backoff: 2 } })
  })
  afterEach(() => {
    vi.unstubAllGlobals()
    vi.useRealTimers()
  })

  it('opens immediately and reports open once the stream attaches', () => {
    const { value } = inScope(() => useEventSource('/api/v1/scrape/events'))
    expect(value.status.value).toBe('connecting')
    expect(last().url).toBe('/api/v1/scrape/events')

    last().emitOpen()
    expect(value.status.value).toBe('open')
  })

  it('parses a JSON frame into data and fires the message handler', () => {
    const seen: unknown[] = []
    const { value } = inScope(() =>
      useEventSource<{ done: number }>('/x', { on: { message: d => seen.push(d) } }),
    )
    last().emitOpen()
    last().emitMessage('{"done":3}')

    expect(value.data.value).toEqual({ done: 3 })
    expect(value.event.value).toBe('message')
    expect(seen).toEqual([{ done: 3 }])
  })

  it('subscribes to a named event just from listing its handler', () => {
    const done: unknown[] = []
    const { value } = inScope(() =>
      useEventSource('/x', { on: { done: d => done.push(d) } }),
    )
    last().emitOpen()
    last().emitNamed('done', '{"ok":true}')

    expect(done).toEqual([{ ok: true }])
    expect(value.event.value).toBe('done')
  })

  it('hands a non-JSON frame over as the raw string rather than throwing', () => {
    const { value } = inScope(() => useEventSource('/x'))
    last().emitMessage('not json')
    expect(value.data.value).toBe('not json')
  })

  it('passes the configured withCredentials to the EventSource', () => {
    configureEventSource({ withCredentials: false })
    inScope(() => useEventSource('/x'))
    expect(last().withCredentials).toBe(false)
    expect(useEventSourceConfig().withCredentials).toBe(false)
  })

  it('reconnects with backoff after the browser closes the stream', () => {
    vi.useFakeTimers()
    inScope(() => useEventSource('/x'))
    const first = last()

    first.emitError(true) // CLOSED -> the composable's backoff owns the reopen
    expect(FakeEventSource.instances).toHaveLength(1)

    vi.advanceTimersByTime(1000)
    expect(FakeEventSource.instances).toHaveLength(2)
  })

  it('does not reconnect for a transient error the browser is still retrying', () => {
    vi.useFakeTimers()
    inScope(() => useEventSource('/x'))
    last().emitError(false) // still CONNECTING

    vi.advanceTimersByTime(60000)
    expect(FakeEventSource.instances).toHaveLength(1)
  })

  it('re-attaches when a getter URL changes, but only while open', () => {
    const url = ref('/a')
    const { value } = inScope(() => useEventSource(() => url.value))
    last().emitOpen()
    expect(last().url).toBe('/a')

    url.value = '/b'
    // watch is async; flush it.
    return Promise.resolve().then(() => {
      expect(last().url).toBe('/b')
      expect(value.source.value).toBeDefined()
    })
  })

  it('closes on scope dispose and stops reconnecting', () => {
    vi.useFakeTimers()
    const { value, stop } = inScope(() => useEventSource('/x'))
    const es = last()
    stop()

    expect(es.readyState).toBe(FakeEventSource.CLOSED)
    expect(value.status.value).toBe('closed')

    // A close that raced an in-flight error must not schedule a reopen.
    vi.advanceTimersByTime(60000)
    expect(FakeEventSource.instances).toHaveLength(1)
  })

  it('honours autoReconnect: false', () => {
    vi.useFakeTimers()
    inScope(() => useEventSource('/x', { autoReconnect: false }))
    last().emitError(true)

    vi.advanceTimersByTime(60000)
    expect(FakeEventSource.instances).toHaveLength(1)
  })
})
