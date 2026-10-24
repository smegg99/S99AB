// web/src/composables/tabs/internal/hintPlacement.ts
import { nextTick, watch } from 'vue'
import type { VTooltip } from 'vuetify/components'

// Places a workspace menu entry's hint off every open menu and the right-clicked row.
// Vuetify's own flip puts it over the row the menu opened from.

/** A rectangle in window coordinates. */
export interface Box {
  left: number
  top: number
  right: number
  bottom: number
}

/** What a hint is placed among. */
export interface HintRoom {
  /** The entry the hint explains. */
  entry: Box
  /** The menu the entry stands in. */
  menu: Box
  /** Where that menu opened from: the pointer, or a submenu's parent menu. */
  from: { x: number, y: number }
  /** What the plate must leave uncovered: every open menu and the row the menu was opened on. */
  keepClear: Box[]
  /** The window less its margin. */
  view: Box
  /** The plate's size once it wraps at `width`. */
  measure: (width: number) => { width: number, height: number }
}

export interface HintPlace {
  left: number
  top: number
  /** The width the plate wraps at. */
  width: number
}

/** The widest a hint wraps at. */
export const HINT_WIDTH = 300
/** The narrowest it wraps at beside its entry; with less room it opens under or over the menu. */
export const HINT_NARROWEST = 200
/** Between the plate and the menu: Vuetify's tooltip offset. */
const GAP = 10
/** Between the plate and the window's edge: Vuetify's viewport margin. */
const MARGIN = 12

function overlaps(a: Box, b: Box): boolean {
  return a.left < b.right && b.left < a.right && a.top < b.bottom && b.top < a.bottom
}

function within(a: Box, view: Box): boolean {
  return a.left >= view.left - 0.5 && a.right <= view.right + 0.5 && a.top >= view.top - 0.5 && a.bottom <= view.bottom + 0.5
}

function clamp(value: number, low: number, high: number): number {
  return Math.max(low, Math.min(value, high))
}

function boxAt(left: number, top: number, size: { width: number, height: number }): Box {
  return { left, top, right: left + size.width, bottom: top + size.height }
}

/** A spot for the plate: where it opens, the width it wraps at, and its size there. */
interface Spot extends HintPlace {
  size: { width: number, height: number }
}

/**
 * First spot inside the view and off keepClear: menu's far side, then under/over, over/under,
 * near side. With none, the second spot clamped into the view, over the menu.
 */
export function placeHint(room: HintRoom): HintPlace {
  const { entry, menu, from, keepClear, view, measure } = room
  const toRight = from.x <= (menu.left + menu.right) / 2
  const down = from.y <= (menu.top + menu.bottom) / 2
  const clear = (at: Spot) => {
    const box = boxAt(at.left, at.top, at.size)
    return within(box, view) && !keepClear.some(each => overlaps(box, each))
  }
  function spot(left: number, top: number, width: number, size: Spot['size'], below: boolean): Spot {
    const hit = keepClear.find(each => overlaps(boxAt(left, top, size), each))
    return { left, top: hit ? (below ? hit.bottom : hit.top - size.height) : top, width, size }
  }
  function beside(end: boolean): Spot | null {
    const width = Math.min(HINT_WIDTH, end ? view.right - menu.right - GAP : menu.left - GAP - view.left)
    if (width < HINT_NARROWEST) return null
    const size = measure(width)
    const left = end ? menu.right + GAP : menu.left - GAP - size.width
    return spot(left, clamp((entry.top + entry.bottom) / 2 - size.height / 2, view.top, view.bottom - size.height), width, size, down)
  }
  function across(below: boolean): Spot {
    const width = Math.min(HINT_WIDTH, view.right - view.left)
    const size = measure(width)
    const left = clamp(toRight ? menu.left : menu.right - size.width, view.left, view.right - size.width)
    return spot(left, below ? menu.bottom + GAP : menu.top - GAP - size.height, width, size, below)
  }

  const far = beside(toRight)
  if (far && clear(far)) return far
  const second = across(down)
  if (clear(second)) return second
  const found = [across(!down), beside(!toRight)].find(each => each && clear(each))
  return found ?? { ...second, top: clamp(second.top, view.top, view.bottom - second.size.height) }
}

type LocationStrategy = Extract<NonNullable<VTooltip['$props']['locationStrategy']>, (...args: never[]) => unknown>

/** Where a menu opened from: the pointer, or a submenu's parent menu. */
export interface HintOrigin {
  x: number
  y: number
  /** The row the menu was opened on, which the plate keeps clear of. */
  row?: Element | null
}

function boxOf(el: Element): Box {
  const { left, top, right, bottom } = el.getBoundingClientRect()
  return { left, top, right, bottom }
}

/**
 * A Vuetify location strategy for an entry's hint tooltip (activator: the
 * entry's row), placing it with placeHint among the open menus.
 */
export function besideMenu(origin: () => HintOrigin): LocationStrategy {
  return (data, _props, contentStyles) => {
    function updateLocation() {
      const plate = data.contentEl.value
      const entry = data.target.value
      const menu = entry instanceof Element ? entry.closest('.v-overlay__content') : null
      if (!plate || !(entry instanceof Element) || !menu) return
      const from = origin()
      const keepClear = [...document.querySelectorAll('.v-menu .v-overlay__content')]
        .filter(each => each.getClientRects().length)
        .map(boxOf)
      if (from.row) keepClear.push(boxOf(from.row))
      const { clientWidth, clientHeight } = document.documentElement
      // Measured at the window's corner; near an edge the plate would wrap narrower.
      const measure = (width: number) => {
        Object.assign(plate.style, { position: 'fixed', left: '0px', top: '0px', maxWidth: `${width}px` })
        const { width: w, height } = plate.getBoundingClientRect()
        return { width: w, height }
      }
      const place = placeHint({
        entry: boxOf(entry),
        menu: boxOf(menu),
        from,
        keepClear,
        view: { left: MARGIN, top: MARGIN, right: clientWidth - MARGIN, bottom: clientHeight - MARGIN },
        measure,
      })
      const styles = { position: 'fixed', left: `${place.left}px`, top: `${place.top}px`, maxWidth: `${place.width}px` }
      // Also on the element: measuring wrote to it, and Vue patches only diffs.
      Object.assign(plate.style, styles)
      contentStyles.value = styles
    }
    watch(data.contentEl, (el) => {
      if (el) void nextTick(updateLocation)
    }, { immediate: true })
    return { updateLocation }
  }
}
