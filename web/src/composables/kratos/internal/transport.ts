// web/src/composables/kratos/internal/transport.ts

/** How long a Kratos call may take before it counts as unreachable. */
export const KRATOS_TIMEOUT_MS = 15_000

// Feature-detected: jsdom does not always have AbortSignal.timeout.
function deadline(): AbortSignal | undefined {
  return typeof AbortSignal !== 'undefined' && 'timeout' in AbortSignal
    ? AbortSignal.timeout(KRATOS_TIMEOUT_MS)
    : undefined
}

/**
 * Every Kratos public call: the session cookie, a deadline unless the caller brings its own signal, and
 * the JSON accept header, which makes Kratos answer with the flow instead of a redirect.
 */
export function kratosFetch(url: string, init: RequestInit = {}): Promise<Response> {
  return fetch(url, {
    credentials: 'include',
    ...init,
    signal: init.signal ?? deadline(),
    headers: { accept: 'application/json', ...(init.headers as Record<string, string> | undefined) },
  })
}

/** `?return_to=` (or `&return_to=`) for a target, or '' without one. */
export function returnToQuery(to: string | undefined, joiner: '?' | '&' = '?'): string {
  return to ? `${joiner}return_to=${encodeURIComponent(to)}` : ''
}
