// web/src/composables/toast/internal/stack.ts

/**
 * Distance of a toast from its stack's edge, from the heights of the toasts nearer that edge.
 * The oldest toast is furthest out, so its expiry moves no other toast.
 */
export function stackLift(heights: number[], index: number): string {
  let px = 0
  for (let i = 0; i < index; i++) px += heights[i] ?? 0
  return `calc(${px}px + ${index} * var(--s99ab-toast-gap))`
}
