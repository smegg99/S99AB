// web/src/composables/state/useAsyncState.ts

import { computed, type ComputedRef, type Ref } from 'vue'
import { useDelayed } from '../useDelay'

/** The part of a Colada query these helpers read, typed structurally. */
export interface QueryLike<T = unknown> {
  data: Ref<T | undefined>
  error: Ref<unknown>
  asyncStatus: Ref<string>
}

/**
 * True while the first load is in flight past the useDelay threshold. A
 * refetch with data never shows it.
 */
export function useFirstLoad(q: QueryLike): Ref<boolean> {
  return useDelayed(
    () => q.asyncStatus.value === 'loading' && q.data.value === undefined,
  )
}

/** True when the query succeeded and returned nothing to show. */
export function useIsEmpty(q: QueryLike<unknown>): ComputedRef<boolean> {
  return computed(() => {
    const data = q.data.value
    if (data === undefined || q.error.value) return false
    if (Array.isArray(data)) return data.length === 0
    if (data && typeof data === 'object' && 'items' in data) {
      return (data as { items: unknown[] }).items.length === 0
    }
    return false
  })
}
