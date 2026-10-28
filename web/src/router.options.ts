// web/src/router.options.ts
//
// The layer's scrollBehavior, needed because UiAppShell scrolls a region and not
// the window. Registered by the pages:routerOptions hook in nuxt.config.

import { shellScrollBehavior } from './composables/shell/internal/scroll'
import type { RouterScrollBehavior } from 'vue-router'

const scrollBehavior: RouterScrollBehavior = (to, from, saved) =>
  shellScrollBehavior(to, from, saved)

export default { scrollBehavior }
