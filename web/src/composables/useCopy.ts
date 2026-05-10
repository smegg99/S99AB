// web/src/composables/useCopy.ts

import { onScopeDispose, readonly, ref } from 'vue'

/** Copies to the clipboard and sets a flag briefly for the button's icon. */
export function useCopy(resetMs = 1600) {
  const copied = ref(false)
  let timer: ReturnType<typeof setTimeout> | undefined

  async function copy(text: string) {
    if (!text || typeof navigator === 'undefined') return

    try {
      await navigator.clipboard.writeText(text)
      copied.value = true
      if (timer) clearTimeout(timer)
      timer = setTimeout(() => {
        copied.value = false
      }, resetMs)
    }
    catch {
      // Insecure origin or permission refused; the value stays selectable on screen.
    }
  }

  onScopeDispose(() => {
    if (timer) clearTimeout(timer)
  })

  return { copied: readonly(copied), copy }
}
