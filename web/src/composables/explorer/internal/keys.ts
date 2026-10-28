// web/src/composables/explorer/internal/keys.ts

// Grid keyboard: arrows move focus and selection, ctrl moves focus only, shift
// extends, space picks. Enter is handled by the tile.
// Columns and tiles are read from the DOM; a custom tile must spread useExplorerNode's bindings.

/** Marks a focusable tile, and carries its node id. */
export const TILE_ATTR = 'data-s99ab-tile'

export interface ExplorerKeyMods {
  ctrl: boolean
  shift: boolean
}

export interface ExplorerKeyHost {
  /** Whether the arrow keys move focus. */
  enabled: () => boolean
  /** Focus landed on a tile; the host updates the selection. */
  moved?: (id: string, mods: ExplorerKeyMods) => void
  /** Space picks the focused tile; ctrl+space toggles it. */
  choose?: (id: string, mods: ExplorerKeyMods) => void
  /** ctrl+a; false leaves the browser's select-all. */
  selectAll?: () => boolean
  /** Escape; false leaves the key alone. */
  clear?: () => boolean
}

export function columnsOf(grid: HTMLElement): number {
  const template = getComputedStyle(grid).gridTemplateColumns
  // happy-dom and an unlaid grid answer 'none'; fall back to one column.
  const count = template.split(' ').filter(Boolean).length
  return template === 'none' || !count ? 1 : count
}

/** Bind onKeydown on the grid element; it reads the grid from currentTarget (TransitionGroup hides a ref). */
export function useExplorerKeys(host: ExplorerKeyHost) {
  function onKeydown(event: KeyboardEvent) {
    const grid = event.currentTarget as HTMLElement | null
    if (!grid) return

    const mods = { ctrl: event.ctrlKey || event.metaKey, shift: event.shiftKey }

    if (host.selectAll && event.key === 'a' && mods.ctrl) {
      if (host.selectAll()) event.preventDefault()
      return
    }

    if (host.clear && event.key === 'Escape') {
      if (host.clear()) event.preventDefault()
      return
    }

    const tiles = [...grid.querySelectorAll<HTMLElement>(`[${TILE_ATTR}]`)]
    const from = tiles.indexOf(document.activeElement as HTMLElement)
    // Focus is not on a tile.
    if (from === -1) return

    if (host.choose && event.key === ' ') {
      const id = tiles[from]?.getAttribute(TILE_ATTR)
      if (!id) return
      // Space would scroll the page.
      event.preventDefault()
      host.choose(id, mods)
      return
    }

    if (!host.enabled()) return

    const wanted = target(event, from, tiles.length, () => columnsOf(grid))
    if (wanted === null) return

    event.preventDefault()
    const landed = tiles[Math.max(0, Math.min(wanted, tiles.length - 1))]
    if (!landed) return
    landed.focus()

    // ctrl moves focus without changing the selection.
    const id = landed.getAttribute(TILE_ATTR)
    if (id && !mods.ctrl) host.moved?.(id, mods)
  }

  return { onKeydown }
}

function target(
  event: KeyboardEvent,
  from: number,
  count: number,
  columns: () => number,
): number | null {
  switch (event.key) {
    case 'ArrowRight': return from + 1
    case 'ArrowLeft': return from - 1
    case 'ArrowDown': return from + columns()
    case 'ArrowUp': return from - columns()
    case 'Home': return 0
    case 'End': return count - 1
    default: return null
  }
}
