// web/src/composables/tabs/useTabs.ts

import { computed, ref, watch, type Ref } from 'vue'

export interface WorkspaceTab {
  id: string
  pinned?: boolean
  moving?: boolean
  departed?: boolean
  state?: Record<string, unknown>
}

export interface TabsOptions<T extends WorkspaceTab, P> {
  home: T
  make: (place: P) => Omit<T, 'id'>
  read: (tab: T) => P
  apply: (tab: T, place: P) => void
  key: (tab: T) => string
  isHome: (place: P) => boolean
  trailLimit?: number
}

/** One window's tabs. Application places remain opaque to the library. */
export function useTabs<T extends WorkspaceTab, P>(options: TabsOptions<T, P>) {
  const home = options.home
  const tabs = ref([{ ...home }]) as Ref<T[]>
  const activeId = ref(home.id)
  const history = ref([home.id])
  const active = computed(() => tabs.value.find(tab => tab.id === activeId.value) ?? tabs.value[0]!)
  const pinnedCount = computed(() => tabs.value.filter(tab => tab.pinned).length)
  let made = 0
  let spawned: { from: string, id: string } | null = null
  type Place = { tab: string, payload: P }
  const placeOf = (tab: T): Place => ({ tab: tab.id, payload: options.read(tab) })
  const same = (a: Place | undefined, b: Place) => !!a && a.tab === b.tab && JSON.stringify(a.payload) === JSON.stringify(b.payload)
  const trail = ref([placeOf(home)]) as Ref<Place[]>
  const at = ref(0)

  function activate(id: string) {
    if (!tabs.value.some(tab => tab.id === id)) return
    activeId.value = id
    history.value = [...history.value.filter(value => value !== id), id]
  }
  function remove(ids: Set<string>) {
    tabs.value = tabs.value.filter(tab => tab.pinned || tab.moving || !ids.has(tab.id))
    history.value = history.value.filter(id => tabs.value.some(tab => tab.id === id))
    if (!tabs.value.some(tab => tab.id === activeId.value)) activeId.value = history.value.at(-1) ?? home.id
  }
  function settle(tab: T) {
    const twins = tabs.value.filter(other => other.id !== tab.id && !other.pinned && options.key(other) === options.key(tab))
    if (twins.some(other => other.id === activeId.value)) activate(tab.id)
    remove(new Set(twins.map(other => other.id)))
  }
  function add(place: P, slot: number): T {
    const id = `tab:${++made}`
    tabs.value.splice(Math.max(slot, pinnedCount.value), 0, { ...options.make(place), id } as T)
    return tabs.value.find(tab => tab.id === id)!
  }
  function open(place: P, { newTab = false } = {}): T {
    if (options.isHome(place)) {
      activate(home.id)
      return active.value
    }
    const here = active.value
    if (!newTab && !here.pinned && !here.moving) {
      options.apply(here, place)
      settle(here)
      return here
    }
    let slot = tabs.value.findIndex(tab => tab.id === activeId.value)
    if (newTab && spawned?.from === activeId.value) {
      const last = tabs.value.findIndex(tab => tab.id === spawned!.id)
      if (last !== -1) slot = last
    }
    const tab = add(place, slot + 1)
    if (newTab) spawned = { from: activeId.value, id: tab.id }
    else activate(tab.id)
    settle(tab)
    return tab
  }
  function close(id: string) {
    remove(new Set([id]))
  }
  function closeOthers(id: string) {
    remove(new Set(tabs.value.filter(tab => tab.id !== id).map(tab => tab.id)))
    activate(id)
  }
  function closeRight(id: string) {
    const index = tabs.value.findIndex(tab => tab.id === id)
    if (index !== -1) remove(new Set(tabs.value.slice(index + 1).map(tab => tab.id)))
  }
  function closeAll() {
    remove(new Set(tabs.value.map(tab => tab.id)))
  }
  function cycle(step: 1 | -1) {
    const index = tabs.value.findIndex(tab => tab.id === activeId.value)
    const next = tabs.value[(index + step + tabs.value.length) % tabs.value.length]
    if (next) activate(next.id)
  }
  function move(id: string, to: number) {
    const tab = tabs.value.find(tab => tab.id === id)
    if (!tab || tab.pinned || tab.moving) return
    const list = tabs.value.filter(tab => tab.id !== id)
    list.splice(Math.min(Math.max(to, pinnedCount.value), list.length), 0, tab)
    tabs.value = list
  }
  function adopt(incoming: T, id: string, slot: number) {
    const existing = tabs.value.find(tab => tab.id === id)
    if (existing) return existing
    const tab = { ...incoming, id, pinned: false, moving: false, departed: false }
    tabs.value.splice(Math.max(pinnedCount.value, Math.min(slot, tabs.value.length)), 0, tab)
    activate(id)
    settle(tab)
    return tabs.value.find(tab => tab.id === id)!
  }
  function release(id: string) {
    const tab = tabs.value.find(tab => tab.id === id)
    if (tab) {
      tab.moving = false
      tab.departed = true
    }
    remove(new Set([id]))
  }
  watch(() => placeOf(active.value), (here) => {
    if (same(trail.value[at.value], here)) return
    trail.value = [...trail.value.slice(0, at.value + 1), here].slice(-(options.trailLimit ?? 100))
    at.value = trail.value.length - 1
  })
  function stop(step: -1 | 1): number {
    const here = placeOf(active.value)
    const passed = (place: Place) => !tabs.value.some(tab => tab.id === place.tab) || same(place, here)
    let index = at.value + step
    while (trail.value[index] && passed(trail.value[index]!)) index += step
    return trail.value[index] ? index : -1
  }
  const canGo = computed(() => ({ back: stop(-1) !== -1, forward: stop(1) !== -1 }))
  function go(step: -1 | 1) {
    const index = stop(step)
    const to = trail.value[index]
    const tab = tabs.value.find(tab => tab.id === to?.tab)
    if (!to || !tab || tab.moving) return
    at.value = index
    options.apply(tab, to.payload)
    activate(tab.id)
    settle(tab)
  }
  function refile(tab: T, update: () => void) {
    const before = placeOf(tab)
    update()
    const after = placeOf(tab)
    trail.value = trail.value.map(place => same(place, before) ? after : place)
    settle(tab)
  }
  /** Administrative removal also forgets history for those places. */
  function closeWhere(test: (place: P) => boolean) {
    tabs.value = tabs.value.filter(tab => !test(options.read(tab)))
    if (!tabs.value.length) tabs.value = [{ ...home }]
    history.value = history.value.filter(id => tabs.value.some(tab => tab.id === id))
    if (!tabs.value.some(tab => tab.id === activeId.value)) activeId.value = history.value.at(-1) ?? tabs.value[0]!.id
    const kept: Place[] = []
    let now = -1
    trail.value.forEach((place, index) => {
      if (test(place.payload)) return
      if (index <= at.value) now = kept.length
      kept.push(place)
    })
    trail.value = kept
    at.value = now
  }
  function snapshot() {
    const open = tabs.value.filter(tab => tab.id !== home.id)
    return { tabs: open.map(options.read), active: open.findIndex(tab => tab.id === activeId.value) + 1 }
  }
  function restore(places: readonly P[], front: number) {
    tabs.value = [{ ...home }]
    for (const place of places) add(place, tabs.value.length)
    activeId.value = tabs.value[front]?.id ?? home.id
    history.value = activeId.value === home.id ? [home.id] : [home.id, activeId.value]
    spawned = null
    trail.value = [placeOf(active.value)]
    at.value = 0
  }
  function reset() {
    restore([], 0)
  }
  return { tabs, activeId, active, history, activate, add, open, settle, close, closeOthers, closeRight, closeAll, cycle, move, adopt, release, canGo, go, refile, closeWhere, snapshot, restore, reset }
}
