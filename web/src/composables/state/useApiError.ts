// web/src/composables/state/useApiError.ts

import { useTranslate } from '../useTranslate'

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

/**
 * Turns any thrown value into something showable. The envelope's `message` is
 * an i18n key; any other error shows the generic key and the caller logs it.
 */
export function useApiError() {
  const t = useTranslate()

  return (
    err: unknown,
  ): { code: string, text: string, details?: Record<string, string> } => {
    const api = toApiError(err)
    if (api) {
      return {
        code: api.code,
        // Fall back to the key, so a missing translation names the missing key.
        text: t(api.message),
        details: api.details,
      }
    }
    return {
      code: 'unknown',
      text: t('error.unknown', 'Something went wrong.'),
    }
  }
}
