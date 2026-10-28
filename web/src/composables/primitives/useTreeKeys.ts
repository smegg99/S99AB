// web/src/composables/primitives/useTreeKeys.ts
import { nextTick, type Ref, shallowRef } from 'vue'
import { useFocusGroup } from './useFocusGroup'

/**
 * Arrow-key walking of a drawer tree over rows with `data-node`, `data-branch` and `data-parent`.
 * Alt+arrow is left to the workspace shortcuts, so a step does not run twice.
 */
export function useTreeKeys(root: Ref<HTMLElement | null>, opened: (id: string) => boolean, toggle: (id: string) => void, first = '') {
  const focus = shallowRef(first)

  function rows(): HTMLElement[] {
    return [...(root.value?.querySelectorAll<HTMLElement>('[data-node]') ?? [])]
  }

  const ring = useFocusGroup(root)
  function focusRow(id: string, keyed = true) {
    focus.value = id
    ring.mark(keyed)
    void nextTick(() => root.value?.querySelector<HTMLElement>(`[data-node="${CSS.escape(id)}"]`)?.focus())
  }

  function onKey(event: KeyboardEvent) {
    if (event.altKey) {
      // Still a key in the tree: a row the shortcut moves the focus to is ringed.
      ring.mark()
      return
    }
    const shown = rows()
    const at = shown.findIndex(el => el.dataset.node === focus.value)
    const row = shown[at]
    if (!row) return
    const id = focus.value
    const branch = row.dataset.branch !== undefined
    let next: string | undefined
    switch (event.key) {
      case 'ArrowDown':
        next = shown[at + 1]?.dataset.node
        break
      case 'ArrowUp':
        next = shown[at - 1]?.dataset.node
        break
      case 'Home':
        next = shown[0]?.dataset.node
        break
      case 'End':
        next = shown.at(-1)?.dataset.node
        break
      case 'ArrowRight':
        if (branch && !opened(id)) toggle(id)
        else if (branch) next = shown[at + 1]?.dataset.node
        break
      case 'ArrowLeft':
        if (branch && opened(id)) toggle(id)
        else next = row.dataset.parent || undefined
        break
      case 'Enter':
      case ' ':
        if (branch) toggle(id)
        else row.click()
        break
      default:
        return
    }
    event.preventDefault()
    if (next) focusRow(next)
  }

  return { focus, focusRow, onKey, keyed: ring.keyed }
}
