// web/src/composables/explorer/internal/crumbs.ts

// Explorer toolbar breadcrumbs: crumb model, crumb drop targets and the scroll that keeps the open folder in view.

import {
  computed,
  nextTick,
  onMounted,
  onScopeDispose,
  ref,
  watch,
} from 'vue'
import type { ExplorerApi } from '../useExplorer'
import { useTranslate } from '../../useTranslate'

export interface ExplorerCrumb {
  key: string
  id: string | null
  name: string
  accent: string
  icon?: string
  current: boolean
  /** Set on the open folder for screen readers. */
  ariaCurrent?: 'page'
}

export function useExplorerCrumbs<T = unknown>(explorer: ExplorerApi<T>) {
  const t = useTranslate()

  const crumbsEl = ref<HTMLElement | null>(null)
  const fadeStart = ref(false)
  const fadeEnd = ref(false)

  let frame = 0
  let observer: ResizeObserver | undefined

  const homeLabel = computed(() => t('explorer.home', 'Home'))

  // Home plus the open folder's ancestors; each crumb is a drop target.
  const crumbs = computed<ExplorerCrumb[]>(() => {
    const path = explorer.path.value
    return [
      entry({
        key: 'crumb:home',
        id: null,
        name: homeLabel.value,
        accent: '',
        icon: explorer.icons.value.home,
        current: path.length === 0,
      }),
      ...path.map((node, i) => entry({
        key: `crumb:${node.id}`,
        id: node.id,
        name: node.name,
        accent: node.accent ?? '',
        current: i === path.length - 1,
      })),
    ]
  })

  watch(crumbs, () => {
    if (typeof window === 'undefined') return
    void nextTick(() => {
      cancelAnimationFrame(frame)
      frame = requestAnimationFrame(syncScroll)
    })
  }, { immediate: true })

  // Recompute the fade masks on resize.
  onMounted(() => {
    if (typeof ResizeObserver === 'undefined' || !crumbsEl.value) return
    observer = new ResizeObserver(updateFade)
    observer.observe(crumbsEl.value)
  })

  onScopeDispose(() => {
    observer?.disconnect()
    cancelAnimationFrame(frame)
  })

  function entry(crumb: Omit<ExplorerCrumb, 'ariaCurrent'>): ExplorerCrumb {
    return { ...crumb, ariaCurrent: crumb.current ? 'page' : undefined }
  }

  // Kept out of the crumb model so hover changes do not rerun the scroll sync.
  function isTarget(crumb: ExplorerCrumb): boolean {
    return explorer.drag.hover.value === crumb.key
  }

  function updateFade() {
    const el = crumbsEl.value
    if (!el) return
    fadeStart.value = el.scrollLeft > 1
    fadeEnd.value = el.scrollLeft + el.clientWidth < el.scrollWidth - 1
  }

  // Runs in a frame after nextTick: crumb widths (icon glyphs) are not laid out at nextTick.
  function syncScroll() {
    frame = 0
    const el = crumbsEl.value
    if (!el) return
    if (el.scrollWidth > el.clientWidth) el.scrollLeft = el.scrollWidth
    updateFade()
  }

  function onDragover(crumb: ExplorerCrumb) {
    if (explorer.drag.canDrop(crumb.id)) explorer.drag.setHover(crumb.key)
  }

  function onDragleave(crumb: ExplorerCrumb) {
    explorer.drag.clearHover(crumb.key)
  }

  function onDrop(crumb: ExplorerCrumb) {
    explorer.drag.setHover(null)
    explorer.drag.dropInto(crumb.id)
  }

  return {
    crumbs,
    crumbsEl,
    fadeStart,
    fadeEnd,
    isTarget,
    updateFade,
    onDragover,
    onDragleave,
    onDrop,
  }
}
