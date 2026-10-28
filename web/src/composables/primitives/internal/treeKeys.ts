// web/src/composables/primitives/internal/treeKeys.ts

import { nextTick } from 'vue'

/**
 * A row made from a pane's key takes the keyboard, since that key left with its pane: selected,
 * then focused without the ring once the tree has drawn it.
 */
export async function takeRow(select: (id: string) => void, tree: () => { focusRow: (id: string, keyed?: boolean) => void } | null | undefined, id: string) {
  select(id)
  await nextTick()
  tree()?.focusRow(id, false)
}
