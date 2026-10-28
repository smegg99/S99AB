// web/src/composables/primitives/internal/pointerDrag.ts
import { computed, onScopeDispose, shallowReactive } from 'vue'
import { trackPointer } from '../../../browser/pointer'

export interface DropPlace<At, Carried> {
  find: (el: Element) => At | null
  takes: (carried: Carried, at: At) => boolean
  /** What a drop there does, which the carried card says beside the pointer; '' says nothing. */
  say?: (carried: Carried, at: At) => string
  /** A drag began, whatever it carries and wherever it will land. */
  begin?: (carried: Carried) => void
  /** The drag ended, landed or not. */
  end?: () => void
  land: (carried: Carried, at: At) => void
}

/** Where a drop would land now: the place's name and what its `find` read there. */
export interface Over {
  name: string
  at: unknown
}

/** Whether an element lies in a drop zone of this name (`data-drop="<name>"` on it or an ancestor). */
export function inZone(el: Element, name: string): boolean {
  return !!el.closest(`[data-drop="${CSS.escape(name)}"]`)
}

/** On the root while a press is held: fields take no pointer, so a drag across one leaves its caret alone (assets/styles/_base.scss). */
const PRESSING = 's99ab-pressing'

/**
 * Pointer drag to any drop place, started after a few pixels so a click still picks. Escape, pointercancel or blur
 * cancel it. `refuse` explains a hold that cannot drag. Window listeners, since WebKitGTK drops pointer capture.
 */
export function createPointerDrag<Carried extends object>(threshold = 5) {
  const state = shallowReactive({
    carried: null as Carried | null,
    over: null as Over | null,
    /** A thing that cannot be carried is held past where a drag would start, and has said why. */
    held: false,
    x: 0,
    y: 0,
  })
  const places = new Map<string, DropPlace<unknown, Carried>>()
  /** The press: what it carries, or why it cannot until that has been said. */
  let pressed: { carried: Carried | null, refuse: (() => void) | null, x: number, y: number } | null = null
  /** A drag just ended on a thing, whose click must not pick it. */
  let swallow = false
  /** The window's listeners are on, from a press until the drag ends. */
  let untrack: (() => void) | null = null

  /** Registers a drop place under a name until the calling scope ends. */
  function place<At>(name: string, spec: DropPlace<At, Carried>) {
    const held = spec as DropPlace<unknown, Carried>
    places.set(name, held)
    onScopeDispose(() => {
      if (places.get(name) !== held) return
      places.delete(name)
      if (state.over?.name === name) state.over = null
    })
  }

  /** Carries a thing once the pointer has moved far enough from where it was pressed. */
  function grab(carried: Carried, event: PointerEvent) {
    press(carried, null, event)
  }

  /** A thing that cannot be carried: once the pointer has moved as a drag would, `refuse` says why. */
  function hold(refuse: () => void, event: PointerEvent) {
    press(null, refuse, event)
  }

  function press(carried: Carried | null, refuse: (() => void) | null, event: PointerEvent) {
    if (event.button !== 0) return
    stop()
    pressed = { carried, refuse, x: event.clientX, y: event.clientY }
    document.documentElement.classList.add(PRESSING)
    untrack = trackPointer(event, { move, end: released => (released ? drop() : stop()), key })
  }

  function move(event: PointerEvent) {
    if (!pressed) return
    if (!state.carried) {
      if (Math.hypot(event.clientX - pressed.x, event.clientY - pressed.y) < threshold) return
      if (!pressed.carried) {
        pressed.refuse?.()
        pressed.refuse = null
        state.held = true
        return
      }
      state.carried = pressed.carried
      for (const spec of places.values()) spec.begin?.(pressed.carried)
    }
    state.x = event.clientX
    state.y = event.clientY
    state.over = overAt(document.elementFromPoint(event.clientX, event.clientY))
  }

  /** The place under an element that takes what is carried, the one registered last first. */
  function overAt(el: Element | null): Over | null {
    const carried = state.carried
    if (!el || !carried) return null
    for (const [name, spec] of [...places].reverse()) {
      const at = spec.find(el)
      if (at !== null && spec.takes(carried, at)) return { name, at }
    }
    return null
  }

  function drop() {
    const carried = state.carried
    const over = state.over
    if (!carried && !state.held) {
      stop()
      return
    }
    swallow = true
    setTimeout(() => (swallow = false))
    // The place lands it before the drag ends, while what it learned during
    // the drag (a week's busy cells) still stands.
    try {
      if (carried && over) places.get(over.name)?.land(carried, over.at)
    }
    finally {
      stop()
    }
  }

  function key(event: KeyboardEvent): boolean {
    if (event.key !== 'Escape' || !pressed) return false
    event.preventDefault()
    event.stopPropagation()
    return true
  }

  function stop() {
    const was = state.carried
    pressed = null
    state.carried = null
    state.over = null
    state.held = false
    if (untrack) {
      const end = untrack
      untrack = null
      document.documentElement.classList.remove(PRESSING)
      end()
    }
    if (was) for (const spec of places.values()) spec.end?.()
  }

  /** Whether a click is the end of a drag or a hold, not a pick. */
  function dragged(): boolean {
    return swallow
  }

  /** What a drop where the pointer is would do, in words; '' for nothing. */
  const say = computed(() => {
    const { carried, over } = state
    if (!carried || !over) return ''
    return places.get(over.name)?.say?.(carried, over.at) ?? ''
  })

  onScopeDispose(stop)

  return { state, place, grab, hold, dragged, say, cancel: stop }
}
