// web/src/composables/shell/useScrollSpy.ts

import { getCurrentInstance, onMounted, onScopeDispose, ref, watch, type Ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { quietScroll, regionInset, scrollSettling } from './useShellScroll'

// Mirrors the on-screen section of a long page into the URL hash with `replace`.
// A scroll listener: IntersectionObserver cannot answer "last section whose top has passed".

/** The region UiAppShell scrolls. */
const REGION = '.shell__main'

/** Slack below the region's top, so rounding does not flicker between two sections. */
const SLACK = 4

/** How long to look for the region before giving up, in ms. */
const PATIENCE = 2000

/** One tick: rAF or a timeout, since rAF pauses in a hidden tab. */
const tick = () => new Promise<void>((resolve) => {
  let done = false
  const once = () => {
    if (done) return
    done = true
    resolve()
  }

  if (typeof requestAnimationFrame === 'function') requestAnimationFrame(once)
  setTimeout(once, 32)
})

export interface ScrollSpy {
  /** The section id the user is in, or empty above the first. */
  current: Ref<string>
}

/** Watches a page's sections and reports the one being read. `ids` is re-read when it changes. */
export function useScrollSpy(ids: () => string[]): ScrollSpy {
  const current = ref('')

  const router = useRouter() as ReturnType<typeof useRouter> | undefined
  const route = useRoute() as ReturnType<typeof useRoute> | undefined

  /** The anchor last requested from the URL. See sync. */
  let wanted = route?.hash ?? ''

  let region: Element | null = null
  let queued = false
  let gone = false

  /**
   * Reads which section is on screen. The URL is written only when `scrolled`,
   * since after a navigation the scroll may not have happened yet.
   */
  function measure(scrolled = false) {
    queued = false
    if (!region) return

    // Skipped while a click's smooth scroll is running, so the disc does not
    // pass through every section on the way.
    if (scrollSettling()) return

    const names = ids()
    if (!names.length) {
      current.value = ''
      return
    }

    // Measured from the region's content start, the line the scrollBehavior lands on.
    const top = region.getBoundingClientRect().top + regionInset(region)
    let found = ''

    for (const id of names) {
      const el = document.getElementById(id)
      if (!el) continue

      // Document order, so the last match wins.
      if (el.getBoundingClientRect().top - top <= SLACK) found = id
    }

    // At the very bottom the last section is current, since a short final
    // section can never reach the top.
    const end = region.scrollHeight - region.clientHeight
    if (end > 0 && region.scrollTop >= end - 1) {
      const last = [...names].reverse().find(id => document.getElementById(id))
      if (last) found = last
    }

    current.value = found
    if (scrolled) sync(found)
  }

  // Keeps the URL hash in step with the rail, by `replace` so back still leaves
  // the page. Without a router provider nothing is written.
  function sync(id: string) {
    if (!router || !route) return

    const hash = id ? `#${id}` : ''

    // Compared with the last request, since `replace` is async and route.hash
    // lags behind fast scrolling.
    if (hash === wanted) return
    wanted = hash

    // The user is already there; see quietScroll.
    quietScroll(`${route.path}${hash}`)

    // On failure, reset `wanted`: vue-router abandons a replace that starts while
    // another settles, and a stale value would block every later sync.
    void router.replace({ path: route.path, query: route.query, hash })
      .then(
        (failure) => {
          if (failure) wanted = route.hash
        },
        () => {
          wanted = route.hash
        },
      )
  }

  // One measurement per tick; scroll events fire far more often than frames.
  function onScroll() {
    if (queued) return
    queued = true
    void tick().then(() => measure(true))
  }

  /**
   * Finds the region and listens to it. The nav renders before v-main, so it
   * waits for the region, bounded so a nav outside a shell stops looking.
   */
  async function attach() {
    if (typeof document === 'undefined') return

    region?.removeEventListener('scroll', onScroll)
    region = null

    const deadline = Date.now() + PATIENCE
    for (;;) {
      const found = document.querySelector(REGION)
      if (found) {
        region = found
        break
      }
      if (gone || Date.now() > deadline) return
      await tick()
      // Unmounted while waiting: the page may be gone with it, document too.
      if (gone) return
    }

    region.addEventListener('scroll', onScroll, { passive: true })
    measure()
  }

  // After the tree has rendered. See attach.
  if (getCurrentInstance()) onMounted(attach)
  else void attach()

  // Again when the rows change (a different page's sections).
  watch(() => ids().join(' '), () => void attach(), { flush: 'post' })

  // A navigation resets the comparison, then measures once its scroll lands,
  // since events during the scroll were skipped.
  watch(() => route?.fullPath, async () => {
    wanted = route?.hash ?? ''

    // Wait a tick: route watchers run before scrollBehavior marks the scroll as
    // settling, so measuring now would rewrite the anchor back.
    await tick()
    while (!gone && scrollSettling()) await tick()
    if (gone) return

    measure()
  })

  onScopeDispose(() => {
    gone = true
    region?.removeEventListener('scroll', onScroll)
    region = null
  })

  return { current }
}

/** Same-page anchor ids among `tos`, in drawn order (`/theme#type` counts, `/textures` does not). */
export function anchorsIn(tos: string[], path: string): string[] {
  const ids: string[] = []

  for (const to of tos) {
    const cut = to.indexOf('#')
    if (cut < 0) continue
    if (to.slice(0, cut) !== path) continue

    const id = to.slice(cut + 1)
    if (id && !ids.includes(id)) ids.push(id)
  }

  return ids
}
