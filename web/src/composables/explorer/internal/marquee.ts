// web/src/composables/explorer/internal/marquee.ts

// Rubber-band selection from a press on empty space, using mouse events (the background is not draggable).
// Bound to the scroll region, since the grid does not cover the empty space below the tiles.

import { onScopeDispose, shallowRef } from 'vue'
import { TILE_ATTR } from '../../../browser/tiles'
import { pickMods } from '../../../browser/keys'
import { overlaps } from '../../../browser/rect'

/** Band rectangle relative to the region it is drawn in. */
export interface ExplorerBand {
  left: number
  top: number
  width: number
  height: number
}

export interface ExplorerMarqueeHost {
  enabled: () => boolean
  /** Ids under the band, called on every move. */
  cover: (ids: string[]) => void
  /** Called when a band starts without ctrl/meta. */
  clear: () => void
}

interface Corner {
  x: number
  y: number
}

export function useExplorerMarquee(host: ExplorerMarqueeHost) {
  const band = shallowRef<ExplorerBand | null>(null)

  let grid: HTMLElement | null = null
  let origin: Corner = { x: 0, y: 0 }

  function onMousedown(event: MouseEvent) {
    // Main button only: right opens the menu, middle is autoscroll.
    if (!host.enabled() || event.button !== 0) return

    const el = event.currentTarget as HTMLElement | null
    const target = event.target as HTMLElement | null
    // A press on a tile starts that tile's drag.
    if (!el || !target || target.closest(`[${TILE_ATTR}]`)) return

    grid = el
    origin = { x: event.clientX, y: event.clientY }
    if (!pickMods(event).ctrl) host.clear()

    window.addEventListener('mousemove', onMousemove)
    window.addEventListener('mouseup', stop)
    window.addEventListener('keydown', onKeydown)
  }

  function onMousemove(event: MouseEvent) {
    if (!grid) return
    event.preventDefault()

    const box = grid.getBoundingClientRect()
    const left = Math.min(origin.x, event.clientX)
    const top = Math.min(origin.y, event.clientY)
    const right = Math.max(origin.x, event.clientX)
    const bottom = Math.max(origin.y, event.clientY)

    // Add the region's scroll offset, or the band drifts once the region scrolls.
    band.value = {
      left: left - box.left + grid.scrollLeft,
      top: top - box.top + grid.scrollTop,
      width: right - left,
      height: bottom - top,
    }

    host.cover(covered(grid, { left, top, right, bottom }))
  }

  /** Escape ends the band; the covered tiles stay selected. */
  function onKeydown(event: KeyboardEvent) {
    if (event.key === 'Escape') stop()
  }

  function stop() {
    grid = null
    band.value = null
    window.removeEventListener('mousemove', onMousemove)
    window.removeEventListener('mouseup', stop)
    window.removeEventListener('keydown', onKeydown)
  }

  onScopeDispose(stop)

  return { band, onMousedown }
}

/** Ids of tiles the band intersects. */
export function covered(
  grid: HTMLElement,
  band: { left: number, top: number, right: number, bottom: number },
): string[] {
  const ids: string[] = []

  for (const tile of grid.querySelectorAll<HTMLElement>(`[${TILE_ATTR}]`)) {
    const id = tile.getAttribute(TILE_ATTR)
    if (!id) continue

    if (overlaps(tile.getBoundingClientRect(), band)) ids.push(id)
  }

  return ids
}
