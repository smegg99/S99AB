// web/src/composables/kratos/useAuthDialog.ts

import { useDialog } from '../useDialog'
import { authDialog } from './internal/dialog'
import type { KratosFlowKind } from './useKratosFlow'

export interface AuthDialogOptions {
  kind?: KratosFlowKind
  /** Where Kratos sends the browser once the flow succeeds, if it allows it. */
  returnTo?: string
}

/**
 * Signs in from a dialog, keeping the page's unsaved state. Kratos navigates
 * on success, so the promise settles only when the dialog is dismissed.
 */
export function useAuthDialog() {
  const { openDialog } = useDialog()

  return function askToSignIn(options: AuthDialogOptions = {}) {
    const component = authDialog()
    if (!component) {
      throw new Error('s99ab: the auth dialog is not registered; is the layer plugin loaded?')
    }
    return openDialog(component as never, { ...options }, { width: 'sm' })
  }
}
