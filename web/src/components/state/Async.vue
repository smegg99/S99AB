<!-- web/src/components/state/Async.vue -->
<template>
  <UiAutoHeight>
    <UiMotion name="swap">
      <div
        v-if="firstLoad"
        key="loading"
        :class="stateClass"
      >
        <!-- Replaceable like #empty; useFirstLoad still decides whether it shows. -->
        <slot name="loading">
          <UiLoadingState
            :variant="loadingVariant"
            :inline="loadingInline"
            :rows="rows"
            :lines="lines"
          />
        </slot>
      </div>

      <div
        v-else-if="failed"
        key="error"
        :class="stateClass"
      >
        <slot
          name="error"
          :error="query.error.value"
        >
          <UiErrorState
            :error="query.error.value"
            :retrying="retrying"
            @retry="emit('retry')"
          />
        </slot>
      </div>

      <div
        v-else-if="blank"
        key="empty"
        :class="stateClass"
      >
        <slot name="empty" />
      </div>

      <div
        v-else
        key="content"
      >
        <slot />
      </div>
    </UiMotion>
  </UiAutoHeight>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import UiAutoHeight from '../motion/AutoHeight.vue'
import UiMotion from '../motion/Motion.vue'
import UiErrorState from './ErrorState.vue'
import UiLoadingState from './LoadingState.vue'
import { useFirstLoad, useIsEmpty, type QueryLike } from '../../composables/state/useAsyncState'

/**
 * Branches between first load, failure, empty and content. useFirstLoad and
 * useDelay keep refetches and cached responses from flashing; the box animates.
 */
const {
  query,
  // Explicitly undefined, or Vue casts an absent Boolean prop to false. Unset
  // asks the query; true and false override it.
  empty = undefined,
  loading = 'skeleton',
  rows = 3,
  lines = 'two',
  retrying,
  flush,
} = defineProps<{
  query: QueryLike
  /**
   * Override for emptiness the query cannot see, such as a client-side filter.
   * Unset, an empty array or `items` array is empty.
   */
  empty?: boolean
  /** A list gets a skeleton; anything else has no skeleton shape. */
  loading?: 'skeleton' | 'spinner' | 'inline'
  /** Rows the skeleton stands in for; match the page size. */
  rows?: number
  lines?: 'one' | 'two'
  /** A retry is in flight; passed to the error state's icon. */
  retrying?: boolean
  /** Drop the inset around a state, for a body that already pads. */
  flush?: boolean
}>()

const emit = defineEmits<{ retry: [] }>()

defineSlots<{
  loading?: () => unknown
  error?: (props: { error: unknown }) => unknown
  empty?: () => unknown
  default?: () => unknown
}>()

const firstLoad = useFirstLoad(query)
const isEmpty = useIsEmpty(query)

// Both can be true on a retry; loading wins.
const failed = computed(() => Boolean(query.error.value))

// Never empty while data is undefined, so a caller's `empty` override cannot
// flash the empty state during the first load (same rule as useIsEmpty).
const blank = computed(() => {
  if (query.data.value === undefined) return false
  return empty ?? isEmpty.value
})

const stateClass = computed(() => (flush ? undefined : 's99ab-async__state'))

// `inline` is the spinner sized for a row.
const loadingVariant = computed(() => (loading === 'skeleton' ? 'skeleton' : 'spinner'))
const loadingInline = computed(() => loading === 'inline')
</script>
