// web/src/composables/useDialog.ts

import { getCurrentInstance, inject, readonly } from 'vue'
import {
  DIALOG_CLOSE,
  DIALOG_HOLD,
  closeAllDialogs,
  confirm,
  dialogEntries,
  openDialog,
  prompt,
} from '../internal/dialog'

export type { ConfirmOptions, DialogEntry, DialogOptions, DialogWidth, PromptOptions } from '../internal/dialog'

const noop = () => {}

/**
 * Opens dialogs; inside a dialog it also closes the current one. The resolver
 * is injected by the host, so a dialog needs no close prop or id.
 */
export function useDialog<T = unknown>() {
  const inDialog = getCurrentInstance()
  const close = inDialog ? inject<(value?: T) => void>(DIALOG_CLOSE, noop) : noop
  /** Inside a dialog, keeps backdrop and escape from closing it while `on`. */
  const hold: (on: boolean) => void = inDialog ? inject(DIALOG_HOLD, noop) : noop

  return {
    entries: readonly(dialogEntries),
    openDialog,
    confirm,
    prompt,
    close,
    hold,
    closeAll: closeAllDialogs,
  }
}
