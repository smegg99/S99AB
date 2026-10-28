// web/src/composables/state/useApiError.ts

import { useTranslate } from '../useTranslate'
import { toApiError } from './internal/apiError'

export type { ApiError } from './internal/apiError'

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
