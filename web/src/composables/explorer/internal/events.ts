// web/src/composables/explorer/internal/events.ts

// Explorer events, raised by the composable so screens without <UiExplorer> get them too.
// <UiExplorer> re-emits them as Vue events.

import { onScopeDispose } from 'vue'
import type { ExplorerFolderInput, ExplorerMove } from './types'
import type { ExplorerNode } from './tree'

export interface ExplorerEventMap<T = unknown> {
  /** `null` is the root, which has no node. */
  navigate: [id: string | null, node: ExplorerNode<T> | null]
  /** Fired once the tree is updated; the write may still be in flight. */
  move: [move: ExplorerMove, node: ExplorerNode<T>]
  create: [input: ExplorerFolderInput]
  rename: [id: string, input: ExplorerFolderInput]
  remove: [id: string, recursive: boolean]
  pin: [id: string, pinned: boolean]
  /** A move or folder action failed; the tree is already reloaded. */
  error: [err: unknown]
}

export type ExplorerEventName = keyof ExplorerEventMap

export type ExplorerListener<T, K extends ExplorerEventName>
  = (...args: ExplorerEventMap<T>[K]) => void

// Erased listener type for one shared store; on() and emit() keep the typed contract.
type AnyListener = (...args: never[]) => void

export function createExplorerEvents<T = unknown>() {
  const listeners = new Map<ExplorerEventName, Set<AnyListener>>()

  /** Returns the unsubscribe function; there is no off(name, fn). */
  function on<K extends ExplorerEventName>(
    name: K,
    listener: ExplorerListener<T, K>,
  ): () => void {
    const set = listeners.get(name) ?? new Set<AnyListener>()
    listeners.set(name, set)
    const stored = listener as unknown as AnyListener
    set.add(stored)
    return () => void set.delete(stored)
  }

  function emit<K extends ExplorerEventName>(
    name: K,
    ...args: ExplorerEventMap<T>[K]
  ) {
    // Copy, so a listener can unsubscribe itself while running.
    for (const listener of [...(listeners.get(name) ?? [])]) {
      (listener as unknown as ExplorerListener<T, K>)(...args)
    }
  }

  return { on, emit }
}

export type ExplorerEvents<T = unknown> = ReturnType<typeof createExplorerEvents<T>>

/** Subscribes for the life of the calling scope; a keyed explorer outlives its component. */
export function bindExplorerEvents<T = unknown>(
  events: ExplorerEvents<T>,
  handlers: { [K in ExplorerEventName]?: ExplorerListener<T, K> },
) {
  const offs = Object.entries(handlers).map(
    ([name, listener]) => events.on(
      name as ExplorerEventName,
      listener as unknown as ExplorerListener<T, ExplorerEventName>,
    ),
  )

  onScopeDispose(() => {
    for (const off of offs) off()
  })
}
