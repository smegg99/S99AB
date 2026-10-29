// web/src/composables/shell/useBreadcrumbs.ts
import type { MaybeRefOrGetter } from 'vue'
import { computed, onScopeDispose, toValue, watch } from 'vue'
import { useRoute } from 'vue-router'
import { tail } from './internal/breadcrumbs'
import { flattenLinks, linkMatches } from './internal/nav'
import type { NavGroup, NavLink } from '../../types'

// One step of the trail. `to` is kept for linking, though the bar renders plain text.
export interface Crumb {
  label: string
  to?: string
}

// The nav trail for the active route, "Group > Item". The deepest matching `to`
// wins, so a detail route resolves to its section; a `/` link catches the rest.
export function useBreadcrumbs(groups: MaybeRefOrGetter<NavGroup[]>) {
  // Without a router provider useRoute returns nothing, which yields no crumbs.
  const route = useRoute() as ReturnType<typeof useRoute> | undefined

  const trail = computed<Crumb[]>(() => {
    const path = route?.path
    if (!path) return []
    const fullPath = route.fullPath

    let best: { group?: string, item: NavLink } | undefined
    for (const group of toValue(groups)) {
      for (const item of flattenLinks(group.items)) {
        if (linkMatches(item, path, fullPath) && (!best || item.to.length > best.item.to.length)) {
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

/** Shows `label` as the trailing crumb while the calling component lives; undefined shows none. */
export function useBreadcrumbTail(label: MaybeRefOrGetter<string | undefined>) {
  watch(() => toValue(label), (next) => {
    tail.value = next
  }, { immediate: true })
  onScopeDispose(() => {
    tail.value = undefined
  })
}
