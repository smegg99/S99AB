// web/src/internal/eventSource.ts

import type { EventSourceConfig } from '../composables/useEventSource'

export const config: EventSourceConfig = {
  withCredentials: true,
  reconnect: { delay: 1000, maxDelay: 15000, backoff: 2 },
}

/** Overrides the defaults every useEventSource inherits; `reconnect` is merged. */
export function configureEventSource(patch: Partial<EventSourceConfig>): void {
  if (patch.withCredentials !== undefined) config.withCredentials = patch.withCredentials
  if (patch.reconnect) Object.assign(config.reconnect, patch.reconnect)
}
