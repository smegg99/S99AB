// web/src/composables/explorer/useExplorerFace.ts

// What a tile draws: glyph, cover, label placement and badge.
// Separate from useExplorerNode, so a custom tile can take the behaviour without the look.

import { computed, ref, watch } from 'vue'
import { useExplorerContext } from './useExplorer'
import type { ExplorerNode } from './internal/tree'

export interface ExplorerFaceState {
  isFolder: () => boolean
  /** A drop into this folder is armed; shows the open glyph. */
  isTarget: () => boolean
  /** Child count; 0 for a leaf. */
  count: () => number
}

export function useExplorerFace<T = unknown>(
  node: () => ExplorerNode<T>,
  state: ExplorerFaceState,
) {
  const explorer = useExplorerContext()

  const icon = computed(() => {
    const own = node().icon
    if (own) return own

    const icons = explorer.icons.value
    if (!state.isFolder()) return icons.item
    if (state.isTarget()) return icons.folderOpen
    // Empty-folder glyph only when the app configured one.
    if (!state.count() && icons.folderEmpty) return icons.folderEmpty
    return icons.folder
  })

  // A plain <img> with a failure flag: v-img reveals late or not at all inside a tile.
  const failed = ref(false)
  const src = computed(() => node().image ?? '')
  const image = computed(() => (failed.value ? '' : src.value))
  const fit = computed(() => explorer.tile.value.fit)
  const variant = computed(() => explorer.tile.value.variant)

  // Tiles are reused across nodes, so reset the failure when the source changes.
  watch(src, () => (failed.value = false))

  // 'head': glyph and name centred (folder without cover). 'thumb': preview above the name.
  // Reads `src`, not `image`, so a failed cover does not reflow the grid.
  const layout = computed(() => {
    if (variant.value === 'icon') return 'thumb'
    return state.isFolder() && !src.value ? 'head' : 'thumb'
  })

  // Only the card variant can put the label over the picture.
  const over = computed(() =>
    variant.value === 'card' && !!image.value && explorer.tile.value.label === 'over',
  )

  const badge = computed(() => {
    const own = node().badge
    if (own !== undefined) return String(own)
    if (!state.isFolder() || explorer.tile.value.badge === 'none') return ''
    // The icon variant has no corner for a badge.
    if (variant.value === 'icon') return ''
    // Capped so a large count does not widen the badge.
    const count = state.count()
    return count > 999 ? '999+' : String(count)
  })

  function onImageError() {
    failed.value = true
  }

  return { icon, image, fit, variant, layout, over, badge, onImageError }
}
