// web/src/composables/shell/internal/breadcrumbs.ts

import { ref } from 'vue'

// The trailing crumb for a place the router does not name (a tab, a selected
// row's title). Shared, since only one page is active; useBreadcrumbTail sets it.
export const tail = ref<string>()
