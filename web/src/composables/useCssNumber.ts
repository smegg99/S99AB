// web/src/composables/useCssNumber.ts

import { onScopeDispose, onMounted, ref, type Ref } from 'vue'
import { inBrowser } from '../browser/env'

/**
 * A `:root` custom property as a live number, for knobs Vuetify takes as props
 * (the app bar's `height`). Observes the root's `style` and `class`.
 */
export function useCssNumber(name: string, fallback: number): Ref<number> {
  const value = ref(fallback)
  let observer: MutationObserver | null = null

  function read() {
    if (!inBrowser()) return

    const raw = getComputedStyle(document.documentElement).getPropertyValue(name)
    const parsed = Number.parseFloat(raw)

    // An unparseable value keeps the fallback.
    if (Number.isFinite(parsed)) value.value = parsed
  }

  onMounted(() => {
    read()

    observer = new MutationObserver(read)
    observer.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ['style', 'class'],
    })
  })

  onScopeDispose(() => {
    observer?.disconnect()
    observer = null
  })

  return value
}
