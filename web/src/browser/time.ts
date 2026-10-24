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
