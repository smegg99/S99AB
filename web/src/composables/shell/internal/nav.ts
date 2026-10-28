// web/src/composables/shell/internal/nav.ts

import type { NavLink } from '../../../types'

/**
 * Whether a nav link answers for the route: a `#` link on the full path, an exact link on the path,
 * any other on the path or below it. A new-tab link never does.
 */
export function linkMatches(link: NavLink, path: string, fullPath: string = path): boolean {
  if (link.newTab) return false
  const to = link.to
  if (to.includes('#')) return fullPath === to
  if (link.exact) return path === to
  return path === to || path.startsWith(to === '/' ? '/' : `${to}/`)
}

/** Every link, children after their parent. */
export function flattenLinks(items: NavLink[]): NavLink[] {
  return items.flatMap(i => (i.children ? [i, ...flattenLinks(i.children)] : [i]))
}
