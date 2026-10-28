// web/src/browser/time.ts
const pad = (n: number) => String(n).padStart(2, '0')

/** Time of day as 08:05:09, 24-hour in every language and zero-padded to keep one width. */
export function clock(date: Date): string {
  return `${pad(date.getHours())}:${pad(date.getMinutes())}:${pad(date.getSeconds())}`
}

/** Milliseconds from `date` until the next second begins. */
export function untilNextSecond(date: Date): number {
  return 1000 - date.getMilliseconds()
}

/** Calls `fn` once `ms` has passed without another `run`, with the last arguments; `cancel` drops it. */
export function debounced<A extends unknown[]>(fn: (...args: A) => void, ms: number | (() => number)) {
  let timer: ReturnType<typeof setTimeout> | undefined
  return {
    run(...args: A) {
      clearTimeout(timer)
      timer = setTimeout(() => {
        timer = undefined
        fn(...args)
      }, typeof ms === 'function' ? ms() : ms)
    },
    cancel() {
      clearTimeout(timer)
      timer = undefined
    },
  }
}
