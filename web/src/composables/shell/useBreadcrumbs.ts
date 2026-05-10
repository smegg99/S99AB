// web/src/composables/shell/useBreadcrumbs.ts
import type { MaybeRefOrGetter } from 'vue'
import { computed, ref, toValue } from 'vue'
import { useRoute } from 'vue-router'
import type { NavGroup, NavLink } from '../../types'

// One step of the trail. `to` is kept for linking, though the bar renders plain text.
export interface Crumb {
  label: string
  to?: string
}

// The trailing crumb for a place the router does not name (a tab, a selected
// row's title). Shared, since only one page is active; set and clear it per page.
const tail = ref<string>()

/** Append (or clear, with undefined) the trailing crumb. Clear on unmount. */
export function setBreadcrumbTail(label: string | undefined) {
  tail.value = label
}

// The nav trail for the active route, "Group > Item". The deepest matching `to`
// wins, so a detail route resolves to its section; no match yields no crumbs.
export function useBreadcrumbs(groups: MaybeRefOrGetter<NavGroup[]>) {
  // Without a router provider useRoute returns nothing, which yields no crumbs.
  const route = useRoute() as ReturnType<typeof useRoute> | undefined

  const trail = computed<Crumb[]>(() => {
    const path = route?.path
    if (!path) return []

    let best: { group?: string, item: NavLink } | undefined
    for (const group of toValue(groups)) {
      for (const item of flatten(group.items)) {
        const under = item.exact ? path === item.to : path === item.to || path.startsWith(item.to + '/')
        if (under && (!best || item.to.length > best.item.to.length)) {
          best = { group: group.label, item }
        }
      }
    }
    if (!best) return []

    const crumbs: Crumb[] = []
    if (best.group) crumbs.push({ label: best.group })
    crumbs.push({ label: best.item.label, to: best.item.to })
    if (tail.value) crumbs.push({ label: tail.value })
    return crumbs
  })

  return { trail }
}

function flatten(items: NavLink[]): NavLink[] {
  return items.flatMap(i => (i.children ? [i, ...flatten(i.children)] : [i]))
}
