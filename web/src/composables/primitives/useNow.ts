// web/src/composables/primitives/useNow.ts
import { type ShallowRef, onScopeDispose, shallowRef } from 'vue'
import { untilNextSecond } from '../../browser/time'
import { inBrowser } from '../../browser/env'

const now = shallowRef(new Date())
let readers = 0
let timer: ReturnType<typeof setTimeout> | undefined

function stop() {
  clearTimeout(timer)
  timer = undefined
}

function tick() {
  now.value = new Date()
  timer = setTimeout(tick, untilNextSecond(now.value))
}

function visibility() {
  stop()
  if (!document.hidden) tick()
}

/** The window's shared clock, aligned to seconds and paused while hidden. */
export function useNow(): Readonly<ShallowRef<Date>> {
  if (!inBrowser()) return shallowRef(new Date())
  if (readers++ === 0) {
    now.value = new Date()
    document.addEventListener('visibilitychange', visibility)
    visibility()
  }
  onScopeDispose(() => {
    if (--readers === 0) {
      stop()
      document.removeEventListener('visibilitychange', visibility)
    }
  })
  return now
}
