// web/src/browser/media.ts

import { inBrowser } from './env'

/** Whether a media query matches; false where it cannot be asked (SSR, no matchMedia). */
export function mediaMatches(query: string): boolean {
  if (!inBrowser() || typeof window.matchMedia !== 'function') return false
  return window.matchMedia(query).matches
}

/** Calls `changed` when any of the queries flips; returns the teardown. */
export function onMediaChange(queries: string[], changed: () => void): () => void {
  if (!inBrowser() || typeof window.matchMedia !== 'function') return () => {}
  const lists = queries.map(query => window.matchMedia(query))
  for (const list of lists) list.addEventListener('change', changed)
  return () => {
    for (const list of lists) list.removeEventListener('change', changed)
  }
}
