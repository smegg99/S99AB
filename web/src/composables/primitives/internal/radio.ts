// web/src/composables/primitives/internal/radio.ts

import { nextTick, type Ref } from 'vue'

const STEPS: Record<string, number> = { ArrowRight: 1, ArrowDown: 1, ArrowLeft: -1, ArrowUp: -1 }

/** A radiogroup's keys: one Tab stop on the checked option; arrows, Home and End move and check. */
export function useRadioKeys(options: () => readonly string[], model: Ref<string>) {
  function tabindexOf(option: string): 0 | -1 {
    const list = options()
    const stop = list.includes(model.value) ? model.value : list[0]
    return option === stop ? 0 : -1
  }

  function onKeydown(event: KeyboardEvent) {
    const list = options()
    if (!list.length) return
    const at = Math.max(0, list.indexOf(model.value))
    const to = event.key === 'Home' ? 0 : event.key === 'End' ? list.length - 1 : STEPS[event.key] === undefined ? null : at + STEPS[event.key]!
    if (to === null) return
    event.preventDefault()
    model.value = list[(to + list.length) % list.length]!
    const group = event.currentTarget as HTMLElement | null
    void nextTick(() => group?.querySelector<HTMLElement>('[tabindex="0"]')?.focus())
  }

  return { tabindexOf, onKeydown }
}
