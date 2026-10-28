// web/src/composables/shell/useShellDrawer.ts

import { computed, ref, watch } from 'vue'
import { useDisplay } from 'vuetify'
import type { NavGroup } from '../../types'

/**
 * Whether the shell has a rail, whether it is pinned, and whether it is open.
 * Takes a getter because the shell destructures its props.
 */
export function useShellDrawer(groups: () => NavGroup[]) {
  // md: a desktop window is often narrower than lg's 1280, and the rail should
  // stay there. Below 960 the drawer folds away.
  const { mdAndUp } = useDisplay()

  const drawer = ref(false)

  const hasNav = computed(() => groups().length > 0)
  const permanent = computed(() => mdAndUp.value)
  const showNavToggle = computed(() => hasNav.value && !permanent.value)

  // Binding modelValue makes the initial state the shell's job: open when
  // pinned, closed as an overlay, which also closes it when crossing the breakpoint.
  watch(
    permanent,
    (pinned) => {
      drawer.value = pinned
    },
    { immediate: true },
  )

  function toggleNav() {
    drawer.value = !drawer.value
  }

  return { hasNav, permanent, drawer, showNavToggle, toggleNav }
}
