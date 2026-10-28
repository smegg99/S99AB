// web/src/composables/primitives/internal/slots.ts

import { computed, type ComputedRef, useSlots } from 'vue'

/**
 * The names of the slots this component received, to pass on to the one it wraps: all of them but
 * `except`, or only those in `only`. Only given slots, so the inner component reserves no room.
 */
export function useForwardedSlots(options: { except?: readonly string[], only?: readonly string[] } = {}): ComputedRef<string[]> {
  const slots = useSlots()
  return computed(() => Object.keys(slots).filter(name =>
    options.only ? options.only.includes(name) : !options.except?.includes(name)))
}
