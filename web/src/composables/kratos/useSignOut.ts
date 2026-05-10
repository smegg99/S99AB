// web/src/composables/kratos/useSignOut.ts

import { kratosSignOut } from './internal/api'
import { useToast } from '../toast/useToast'
import { useTranslate } from '../useTranslate'

/** Ends the session; on failure toasts the error and resolves false. */
export function useSignOut() {
  const t = useTranslate()
  const toast = useToast()

  return async function signOut(): Promise<boolean> {
    try {
      await kratosSignOut()
      return true
    }
    catch {
      toast.error(t('auth.signOutFailed', 'Signing out failed. Try again.'))
      return false
    }
  }
}
