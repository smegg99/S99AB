// web/src/composables/explorer/useTileNames.ts
import { onScopeDispose, shallowRef } from 'vue'
import { tileOf, TILE_ATTR } from '../../browser/tiles'

/**
 * Tooltip with a tile's full name when truncated, and with `badge` its corner number; bind with v-on on an Explorer grid.
 * Managed here, not by title: WebKitGTK shows title tooltips on pointer motion, even over a just-opened menu.
 */
export function useTileNames(badge?: (id: string) => string | null, delay = 0) {
  const tip = shallowRef<{ tile: HTMLElement, at: HTMLElement, name: string } | null>(null)
  /** Where the pointer waits for a tooltip: a tile, or a tile's corner number. */
  let pending: HTMLElement | null = null
  // Keyed by node, since a pick or drop redraws the tile element.
  let pressed: string | null = null
  let timer: ReturnType<typeof setTimeout> | undefined

  const idOf = (tile: HTMLElement) => tile.getAttribute(TILE_ATTR)

  function hide() {
    clearTimeout(timer)
    pending = null
    tip.value = null
  }

  /** What the tooltip over this spot of the tile says; empty for none. */
  function textAt(tile: HTMLElement, count: HTMLElement | null): string {
    if (count) return badge?.(idOf(tile) ?? '') ?? ''
    const name = tile.querySelector<HTMLElement>('.s99ab-tile__title')
    const cut = name && (name.scrollWidth > name.clientWidth || name.scrollHeight > name.clientHeight)
    return cut ? name.textContent ?? '' : ''
  }

  /** The corner number under the pointer, measured because the layer passes pointer events through it. */
  function countAt(tile: HTMLElement, event: MouseEvent): HTMLElement | null {
    const count = badge ? tile.querySelector<HTMLElement>('.s99ab-tile__count') : null
    if (!count) return null
    const box = count.getBoundingClientRect()
    const inside = event.clientX >= box.left && event.clientX <= box.right && event.clientY >= box.top && event.clientY <= box.bottom
    return inside ? count : null
  }

  function consider(event: MouseEvent) {
    const tile = tileOf(event.target)
    // Not while a button is down: a rubber band or a drag is crossing it.
    if (!tile || idOf(tile) === pressed || event.buttons) return
    const count = countAt(tile, event)
    const spot = count ?? tile
    if (spot === pending || spot === tip.value?.at) return
    hide()
    const text = textAt(tile, count)
    if (!text) return
    pending = spot
    timer = setTimeout(() => (tip.value = { tile, at: spot, name: text }), delay)
  }

  // A menu counts as a press: one opened from the keyboard comes without one,
  // and after a native drag the tip outlived the right-click that opened it.
  function press(event: Event) {
    const tile = tileOf(event.target)
    pressed = tile && idOf(tile)
    hide()
  }

  const on: Record<string, (event: MouseEvent) => void> = {
    mouseover: consider,
    pointerdown: press,
    contextmenu: press,
    mouseout(event: MouseEvent) {
      const tile = tileOf(event.target)
      const to = event.relatedTarget
      if (!tile || tile.contains(to as Node | null)) return
      const ontoMenu = to instanceof Element && !!to.closest('.v-overlay')
      if (!ontoMenu && pressed === idOf(tile)) pressed = null
      if (pending === tile || tip.value?.tile === tile || (pending && tile.contains(pending))) hide()
    },
  }
  // Within a tile the pointer reaches its corner number without crossing an element.
  if (badge) on.mousemove = consider

  onScopeDispose(hide)
  return { tip, on }
}
