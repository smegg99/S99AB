// web/src/composables/shell/internal/region.ts

/** The region UiAppShell scrolls. */
export const REGION = '.shell__main'

/** One tick: rAF or a timeout, since rAF pauses in a hidden tab. */
export function tick(): Promise<void> {
  return new Promise<void>((resolve) => {
    let done = false
    const once = () => {
      if (done) return
      done = true
      resolve()
    }

    if (typeof requestAnimationFrame === 'function') requestAnimationFrame(once)
    setTimeout(once, 32)
  })
}
