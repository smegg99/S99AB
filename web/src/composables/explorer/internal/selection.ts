// web/src/composables/explorer/internal/selection.ts

import { computed, type InjectionKey, provide, type Ref, shallowRef, watch } from 'vue'
import type { ExplorerApi } from '../useExplorer'
import type { ExplorerNode } from './tree'
import type { ExplorerPickMods, ExplorerSelection } from '../useExplorerSelection'

export function useExplorerSelection<T = unknown>(
  explorer: ExplorerApi<T>,
  model?: Ref<string[]>,
) {
  // Own copy: a v-model ref returns a written value only after the next render.
  const own = shallowRef<string[]>(model ? [...model.value] : [])
  const ids = computed(() => own.value)
  const mode = computed(() => explorer.behaviour.value.select)
  const picked = computed(() => new Set(ids.value))
  const nodes = computed(() => explorer.nodes.value.filter(n => picked.value.has(n.id)))
  const active = computed(() => mode.value !== 'none')

  /** Start of a shift-run: the last tile picked without shift. */
  const anchor = shallowRef<string | null>(null)

  // Clear on folder change; sync, so the model never shows the previous folder's picks.
  watch(() => explorer.currentId.value, () => clear(), { flush: 'sync' })

  function isSelected(id: string): boolean {
    return picked.value.has(id)
  }

  // Skips writing an unchanged set, so watchers of the model do not rerun.
  function set(next: string[]) {
    if (same(next, own.value)) return
    own.value = next
    if (model) model.value = next
  }

  // Adopt writes the screen makes to the model.
  if (model) {
    watch(model, (next) => {
      if (!same(next, own.value)) own.value = [...next]
    }, { flush: 'sync' })
  }

  function clear() {
    anchor.value = null
    set([])
  }

  /** Selects every enabled tile in the open folder. */
  function all() {
    if (mode.value !== 'multi') return
    set(explorer.children.value.filter(n => !n.disabled).map(n => n.id))
  }

  function range(toId: string): string[] {
    const list = explorer.children.value
    const from = list.findIndex(n => n.id === anchor.value)
    const to = list.findIndex(n => n.id === toId)
    // The anchor is gone or in another folder: select just the target.
    if (from === -1 || to === -1) return [toId]

    const [start, end] = from < to ? [from, to] : [to, from]
    return list.slice(start, end + 1).filter(n => !n.disabled).map(n => n.id)
  }

  function pick(node: ExplorerNode<T>, mods: ExplorerPickMods = {}) {
    if (!active.value || node.disabled) return

    if (mode.value === 'single') {
      anchor.value = node.id
      // Only ctrl-click on the selected tile clears a single selection.
      set(mods.ctrl && isSelected(node.id) ? [] : [node.id])
      return
    }

    // The anchor stays through a shift-click, so the run grows and shrinks from one end.
    if (mods.shift && anchor.value) {
      const run = range(node.id)
      set(mods.ctrl ? [...new Set([...own.value, ...run])] : run)
      return
    }

    anchor.value = node.id
    if (mods.ctrl) {
      toggle(node)
      return
    }
    set([node.id])
  }

  function toggle(node: ExplorerNode<T>) {
    if (!active.value || node.disabled) return
    set(isSelected(node.id)
      ? own.value.filter(id => id !== node.id)
      : [...own.value, node.id])
  }

  /** Selects a node unless already selected; used by right-click and drag start. */
  function ensure(node: ExplorerNode<T>) {
    if (!active.value || node.disabled || isSelected(node.id)) return
    pick(node, {})
  }

  /** Selected nodes in grid order, for a group drag. */
  function ordered(): ExplorerNode<T>[] {
    return explorer.children.value.filter(n => picked.value.has(n.id) && !n.disabled)
  }

  return {
    ids,
    nodes,
    mode,
    active,
    anchor,
    isSelected,
    pick,
    toggle,
    ensure,
    ordered,
    set,
    clear,
    all,
  }
}

/** Same ids in any order. */
export function same(a: readonly string[], b: readonly string[]): boolean {
  return a.length === b.length && new Set(b).size === new Set([...a, ...b]).size
}

export const explorerSelectionKey: InjectionKey<ExplorerSelection>
  = Symbol('s99ab:explorer-selection')

export function provideExplorerSelection<T>(selection: ExplorerSelection<T>) {
  provide(explorerSelectionKey, selection as ExplorerSelection)
}
