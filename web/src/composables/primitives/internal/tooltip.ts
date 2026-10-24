// web/src/composables/primitives/internal/tooltip.ts
import { shallowRef } from 'vue'

// The single open hint tooltip (UiDisabledHint, UiWorkspaceMenu). Hover and keyboard
// focus can open two at once; the latest to open closes the previous one.
const owner = shallowRef<unknown>(null)

/** Whether `of`'s tooltip is the one open. */
export function hintTooltipOpen(of: object): boolean {
  return owner.value === of
}

/** Opens `of`'s tooltip in place of whichever is open, or closes it when it is the one open. */
export function setHintTooltipOpen(of: object, open: boolean) {
  if (open) owner.value = of
  else if (owner.value === of) owner.value = null
}
