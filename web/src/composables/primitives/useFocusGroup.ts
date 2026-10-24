// web/src/composables/primitives/useFocusGroup.ts
import { onScopeDispose, type Ref } from 'vue'

/** Retains a keyboard ring across script focus, which WebKit does not mark focus-visible. */
export function useFocusGroup(root: Ref<HTMLElement | null>) {
  let listening: HTMLElement | null = null
  function clear() {
    if (!listening) return
    delete listening.dataset.s99abKeyed
    listening.removeEventListener('pointerdown', clear)
    listening = null
  }
  function mark(keyed = true) {
    if (!keyed) {
      clear()
      return
    }
    const el = root.value
    if (!el || el === listening) return
    clear()
    el.dataset.s99abKeyed = ''
    el.addEventListener('pointerdown', clear)
    listening = el
  }
  onScopeDispose(clear)
  return { mark, keyed: () => root.value?.dataset.s99abKeyed !== undefined }
}
