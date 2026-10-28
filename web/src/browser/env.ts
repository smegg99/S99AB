// web/src/browser/env.ts

/** Whether this runs in a browser, not under SSR or in a worker. */
export function inBrowser(): boolean {
  return typeof window !== 'undefined' && typeof document !== 'undefined'
}
