// web/src/composables/shell/internal/breadcrumbs.ts

import { ref } from 'vue'

// The trailing crumb for a place the router does not name (a tab, a selected
// row's title). Shared, since only one page is active; set and clear it per page.
export const tail = ref<string>()

/** Append (or clear, with undefined) the trailing crumb. Clear on unmount. */
export function setBreadcrumbTail(label: string | undefined) {
  tail.value = label
}
