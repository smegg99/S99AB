// web/src/composables/state/internal/apiError.ts

/** The shared error envelope, as it arrives on the wire. */
export interface ApiError {
  code: string
  message: string
  details?: Record<string, string>
}

/**
 * Pulls the envelope out of whatever the client threw: top level, `.error` or
 * `.data`, depending on the generated client. Null for anything else.
 */
export function toApiError(err: unknown): ApiError | null {
  if (!err || typeof err !== 'object') return null

  const candidates = [
    err,
    (err as Record<string, unknown>).error,
    (err as Record<string, unknown>).data,
  ]

  for (const c of candidates) {
    if (!c || typeof c !== 'object') continue
    const { code, message } = c as Record<string, unknown>
    if (typeof code === 'string' && typeof message === 'string') {
      return c as unknown as ApiError
    }
  }
  return null
}
