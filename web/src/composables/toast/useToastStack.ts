// web/src/composables/toast/useToastStack.ts

import { onBeforeUnmount, reactive } from 'vue'
import { useMotion } from '../motion/useMotion'
import type { Toast, ToastPosition } from './useToast'
import { iconOf, progressOf } from './internal/config'
import { visibleAt } from './internal/queue'
import { stackLift } from './internal/stack'

/** One toast with its render values resolved. */
export interface ToastRow {
  toast: Toast
  icon: string | null
  classes: string[]
  lift: string
  /** Nearest the edge paints in front, so an arrival slides in over the rest. */
  z: number
  /** Lifespan bar duration, or '' when the toast draws none. */
  bar: string
}

/** Places a stack's toasts from their measured heights, one pass per position. */
export function useToastStack() {
  const { resolved } = useMotion()

  // Observed, since a toast changes height on screen (count marker, rewrapped text).
  const heights = reactive(new Map<number, number>())
  const cards = new Map<number, HTMLElement>()
  const owners = new WeakMap<HTMLElement, number>()

  // One stable ref function per toast: a new function each render makes Vue call it with null first.
  const binders = new Map<number, (el: unknown) => void>()

  const observer = typeof ResizeObserver === 'undefined'
    ? undefined
    : new ResizeObserver((entries) => {
        for (const entry of entries) {
          const id = owners.get(entry.target as HTMLElement)
          if (id === undefined) continue
          // Border box, since the next toast has to clear the card's border too.
          const box = entry.borderBoxSize?.[0]
          heights.set(id, Math.ceil(box ? box.blockSize : entry.target.getBoundingClientRect().height))
        }
      })

  onBeforeUnmount(() => observer?.disconnect())

  function measure(id: number, el: unknown) {
    const node = (el ?? null) as HTMLElement | null
    const known = cards.get(id)

    // Vue calls a ref on every patch; the same element is already observed.
    if (known === node) return

    if (known) {
      observer?.unobserve(known)
      cards.delete(id)
    }

    if (!node) {
      heights.delete(id)
      binders.delete(id)
      return
    }

    cards.set(id, node)
    owners.set(node, id)
    heights.set(id, Math.ceil(node.getBoundingClientRect().height))
    observer?.observe(node)
  }

  function cardRef(id: number): (el: unknown) => void {
    let fn = binders.get(id)
    if (!fn) {
      fn = (el: unknown) => measure(id, el)
      binders.set(id, fn)
    }
    return fn
  }

  function heightsAt(stack: Toast[]): number[] {
    return stack.map(toast => heights.get(toast.id) ?? 0)
  }

  /**
   * A stack's rows, newest nearest the edge.
   * A plain function because the visible count comes from the untracked config.
   */
  function rowsAt(position: ToastPosition): ToastRow[] {
    const stack = [...visibleAt(position)].reverse()
    const sizes = heightsAt(stack)

    return stack.map((toast, i) => {
      // No bar with motion off (the animation would jump to empty) or for a sticky toast.
      const progress = progressOf(toast)
      const draws = progress !== 'none' && toast.timeout > 0 && resolved.value !== 'off'

      return {
        toast,
        icon: iconOf(toast),
        classes: draws
          ? [`s99ab-toast--${toast.kind}`, `s99ab-toast--life-${progress}`]
          : [`s99ab-toast--${toast.kind}`],
        lift: stackLift(sizes, i),
        z: stack.length - i,
        // runFor includes the stagger the queue adds to the countdown.
        bar: draws ? `${toast.runFor}ms` : '',
      }
    })
  }

  /** Lift past the whole stack, for the "more waiting" marker. */
  function moreLift(position: ToastPosition): string {
    const sizes = heightsAt(visibleAt(position))
    return stackLift(sizes, sizes.length)
  }

  return { cardRef, moreLift, rowsAt }
}
