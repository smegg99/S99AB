// web/src/composables/useEventSource.ts
//
// Client for the sse Go package: a reactive wrapper over the native EventSource,
// over plain HTTP so it works same-origin in a Wails shell or over the network.

import {
  onScopeDispose,
  readonly,
  ref,
  toValue,
  watch,
  type MaybeRefOrGetter,
  type Ref,
} from 'vue'

import { config } from '../internal/eventSource'

/** connecting: reaching for the stream. open: attached. closed: given up. */
export type EventSourceStatus = 'connecting' | 'open' | 'closed'

export interface EventSourceReconnect {
  /** ms. */
  delay: number
  /** ms. */
  maxDelay: number
  /** Per failed attempt. */
  backoff: number
}

export interface EventSourceConfig {
  /** Send cookies. On by default for a same-origin daemon. */
  withCredentials: boolean
  /** Backoff once the browser has closed the stream. */
  reconnect: EventSourceReconnect
}

export function useEventSourceConfig(): Readonly<EventSourceConfig> {
  return readonly(config) as Readonly<EventSourceConfig>
}

export interface UseEventSourceOptions<T> {
  /**
   * Named events beyond `message`. A frame with an `event:` field is delivered
   * only under that name.
   */
  events?: readonly string[]
  /**
   * Handlers per event name; `message` (or `''`) is the default stream. Any
   * other key is subscribed automatically.
   */
  on?: Record<string, (data: T, ev: MessageEvent) => void>
  /** Open on creation. Default true. */
  immediate?: boolean
  /** Overrides the configured default for this stream. */
  withCredentials?: boolean
  /** Parses each frame. Defaults to JSON.parse, falling back to the raw string. */
  parse?: (raw: string) => T
  /**
   * Reopen after the browser closes the stream. Default true. `false` keeps the
   * native transient retries only; an object tunes the backoff.
   */
  autoReconnect?: boolean | Partial<EventSourceReconnect>
}

export interface UseEventSourceReturn<T> {
  data: Ref<T | undefined>
  /** `message` for the default stream. */
  event: Ref<string | undefined>
  status: Ref<EventSourceStatus>
  error: Ref<Event | undefined>
  /** Undefined while closed or unsupported. */
  source: Ref<EventSource | undefined>
  open: () => void
  /** Detaches and stops reconnecting. */
  close: () => void
}

/**
 * Subscribes to a text/event-stream and exposes frames reactively. A getter URL
 * re-attaches on change; the stream closes with the surrounding scope.
 */
export function useEventSource<T = unknown>(
  url: MaybeRefOrGetter<string>,
  options: UseEventSourceOptions<T> = {},
): UseEventSourceReturn<T> {
  const data = ref<T>() as Ref<T | undefined>
  const event = ref<string>()
  const status = ref<EventSourceStatus>('closed')
  const error = ref<Event>()
  const source = ref<EventSource>()

  const parse = options.parse ?? defaultParse<T>
  const wantsReconnect = options.autoReconnect !== false
  const backoff: EventSourceReconnect = {
    ...config.reconnect,
    ...(typeof options.autoReconnect === 'object' ? options.autoReconnect : {}),
  }

  // Every name with a handler is also subscribed.
  const named = new Set<string>(options.events ?? [])
  for (const name of Object.keys(options.on ?? {})) {
    if (name && name !== 'message') named.add(name)
  }

  let stopped = false
  let attempt = 0
  let retryTimer: ReturnType<typeof setTimeout> | undefined

  function clearRetry() {
    if (retryTimer !== undefined) {
      clearTimeout(retryTimer)
      retryTimer = undefined
    }
  }

  function deliver(name: string, ev: MessageEvent) {
    const parsed = parse(String(ev.data))
    data.value = parsed
    event.value = name
    const handler = options.on?.[name] ?? (name === 'message' ? options.on?.[''] : undefined)
    handler?.(parsed, ev)
  }

  function open() {
    // No EventSource global (server, some test runners): opening is a no-op.
    if (typeof EventSource === 'undefined') return

    stopped = false
    clearRetry()
    source.value?.close()

    status.value = 'connecting'
    const withCredentials = options.withCredentials ?? config.withCredentials
    const es = new EventSource(toValue(url), { withCredentials })
    source.value = es

    es.onopen = () => {
      attempt = 0
      status.value = 'open'
    }
    es.onmessage = ev => deliver('message', ev)
    for (const name of named) {
      es.addEventListener(name, ev => deliver(name, ev as MessageEvent))
    }
    es.onerror = (ev) => {
      error.value = ev
      // The browser retries transient drops itself (readyState CONNECTING); the
      // backoff takes over only at CLOSED.
      if (es.readyState === EventSource.CLOSED) {
        status.value = 'closed'
        if (!stopped && wantsReconnect) scheduleRetry()
      }
      else {
        status.value = 'connecting'
      }
    }
  }

  function scheduleRetry() {
    attempt += 1
    const wait = Math.min(backoff.maxDelay, backoff.delay * backoff.backoff ** (attempt - 1))
    retryTimer = setTimeout(() => {
      if (!stopped) open()
    }, wait)
  }

  function close() {
    stopped = true
    clearRetry()
    source.value?.close()
    source.value = undefined
    status.value = 'closed'
  }

  // A changed URL re-attaches only a live stream, so close() stays final.
  watch(
    () => toValue(url),
    () => {
      if (!stopped && source.value) open()
    },
  )

  onScopeDispose(close)

  if (options.immediate ?? true) open()

  return { data, event, status, error, source, open, close }
}

function defaultParse<T>(raw: string): T {
  try {
    return JSON.parse(raw) as T
  }
  catch {
    // A non-JSON frame is passed through as-is.
    return raw as unknown as T
  }
}
