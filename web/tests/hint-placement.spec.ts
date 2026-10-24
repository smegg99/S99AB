// web/tests/hint-placement.spec.ts
import { describe, expect, it } from 'vitest'
import { type Box, HINT_NARROWEST, HINT_WIDTH, type HintRoom, placeHint } from '../src/composables/tabs/internal/hintPlacement'

// A plate of 560px of text on lines 22px high, padded 5px above and below.
const measure = (width: number) => ({ width: Math.min(width, 560), height: Math.ceil(560 / width) * 22 + 10 })
const box = (left: number, top: number, right: number, bottom: number): Box => ({ left, top, right, bottom })
const overlaps = (a: Box, b: Box) => a.left < b.right && b.left < a.right && a.top < b.bottom && b.top < a.bottom
const plate = (room: HintRoom) => {
  const place = placeHint(room)
  const size = measure(place.width)
  return { ...place, box: box(place.left, place.top, place.left + size.width, place.top + size.height) }
}

// A 1024x700 window less Vuetify's 12px margin.
const view = box(12, 12, 1012, 688)

describe('a menu entry\'s hint', () => {
  // The menu of a tree row right-clicked at x 300, the plate beside it.
  it('opens beside its entry at the menu\'s end, 300px wide, when that side has the room', () => {
    const menu = box(301, 205, 551, 397)
    const row = box(229, 182, 550, 214)
    const at = plate({ entry: box(301, 207, 551, 235), menu, from: { x: 300, y: 198 }, keepClear: [menu, row], view, measure })
    expect(at.left).toBe(561)
    expect(at.width).toBe(HINT_WIDTH)
    expect(overlaps(at.box, row)).toBe(false)
  })

  // At x 520 in a 1024px window the end has 231px; Vuetify alone would turn the
  // plate over to the start, onto the row's label.
  it('wraps narrower at the menu\'s end rather than turn over to the side it was opened from', () => {
    const menu = box(521, 205, 771, 397)
    const row = box(229, 182, 550, 214)
    const at = plate({ entry: box(521, 207, 771, 235), menu, from: { x: 520, y: 198 }, keepClear: [menu, row], view, measure })
    expect(at.left).toBe(781)
    expect(at.width).toBe(231)
    expect(at.width).toBeGreaterThanOrEqual(HINT_NARROWEST)
    expect(overlaps(at.box, menu)).toBe(false)
    expect(overlaps(at.box, row)).toBe(false)
    expect(at.box.right).toBeLessThanOrEqual(view.right)
  })

  it('opens under the menu when its end has less than the narrowest room, from the menu\'s own edge', () => {
    const menu = box(720, 205, 970, 397)
    const row = box(229, 182, 980, 214)
    const at = plate({ entry: box(720, 207, 970, 235), menu, from: { x: 720, y: 198 }, keepClear: [menu, row], view, measure })
    expect(at.top).toBe(407)
    expect(at.left).toBe(712)
    expect(at.width).toBe(HINT_WIDTH)
    expect(overlaps(at.box, menu)).toBe(false)
    expect(overlaps(at.box, row)).toBe(false)
  })

  it('opens over a menu that opened upwards, away from the row under it', () => {
    const menu = box(720, 400, 970, 592)
    const row = box(229, 584, 980, 616)
    const at = plate({ entry: box(720, 402, 970, 430), menu, from: { x: 720, y: 600 }, keepClear: [menu, row], view, measure })
    expect(at.box.bottom).toBe(390)
    expect(overlaps(at.box, row)).toBe(false)
  })

  it('opens at the menu\'s start when the menu turned there itself, away from the pointer at its end', () => {
    const menu = box(700, 205, 950, 397)
    const at = plate({ entry: box(700, 207, 950, 235), menu, from: { x: 950, y: 198 }, keepClear: [menu], view, measure })
    expect(at.box.right).toBe(690)
    expect(at.width).toBe(HINT_WIDTH)
  })

  // A row reaching past the menu's end: the plate starts under it, still beside its entry.
  it('steps below the row the menu was opened on when that row reaches past the menu', () => {
    const menu = box(260, 205, 510, 397)
    const row = box(229, 182, 900, 214)
    const at = plate({ entry: box(260, 207, 510, 235), menu, from: { x: 260, y: 198 }, keepClear: [menu, row], view, measure })
    expect(at.left).toBe(520)
    expect(at.top).toBe(214)
    expect(overlaps(at.box, row)).toBe(false)
  })

  it('keeps a submenu\'s hint off its parent menu', () => {
    const parent = box(301, 205, 551, 397)
    const menu = box(551, 260, 801, 330)
    const at = plate({ entry: box(551, 262, 801, 290), menu, from: { x: 426, y: 301 }, keepClear: [parent, menu], view, measure })
    expect(at.left).toBe(811)
    expect(overlaps(at.box, parent)).toBe(false)
    expect(overlaps(at.box, menu)).toBe(false)
  })

  // A 310x300 menu at (520, 375) in a 1024x700 window with a 3-line hint: the end
  // has 172px and there is no room under the menu.
  it('opens over the menu, above the row it was opened on, when neither its end nor under it has room', () => {
    const menu = box(520, 375, 830, 675)
    const row = box(229, 359, 550, 391)
    const three = (width: number) => ({ width: Math.min(width, HINT_WIDTH), height: 69 })
    const at = placeHint({ entry: box(520, 377, 830, 405), menu, from: { x: 520, y: 375 }, keepClear: [menu, row], view, measure: three })
    expect(at).toMatchObject({ left: 520, top: 290, width: HINT_WIDTH })
    const plateBox = box(at.left, at.top, at.left + HINT_WIDTH, at.top + 69)
    expect(overlaps(plateBox, menu)).toBe(false)
    expect(overlaps(plateBox, row)).toBe(false)
  })

  it('opens beside its entry on the menu\'s near side, off the row, when no room is left above, below or at the end', () => {
    const menu = box(520, 100, 830, 590)
    const row = box(229, 84, 550, 116)
    const tall = (width: number) => ({ width: Math.min(width, HINT_WIDTH), height: 118 })
    const at = placeHint({ entry: box(520, 102, 830, 130), menu, from: { x: 520, y: 100 }, keepClear: [menu, row], view, measure: tall })
    expect(at).toMatchObject({ left: 210, top: 116, width: HINT_WIDTH })
    const plateBox = box(at.left, at.top, at.left + HINT_WIDTH, at.top + 118)
    expect(overlaps(plateBox, menu)).toBe(false)
    expect(overlaps(plateBox, row)).toBe(false)
  })

  it('keeps a submenu\'s hint off the row the menu was opened on', () => {
    const parent = box(301, 205, 551, 397)
    const menu = box(551, 207, 801, 277)
    const row = box(229, 182, 1000, 214)
    const at = plate({ entry: box(551, 209, 801, 237), menu, from: { x: 426, y: 301 }, keepClear: [parent, menu, row], view, measure })
    expect(at.left).toBe(811)
    for (const each of [parent, menu, row]) expect(overlaps(at.box, each)).toBe(false)
  })

  // The one case it covers the menu: no clear spot anywhere in the window.
  it('stays inside the window when no side has clear room', () => {
    const small = box(12, 12, 512, 288)
    const menu = box(150, 20, 400, 280)
    const at = plate({ entry: box(150, 22, 400, 50), menu, from: { x: 150, y: 15 }, keepClear: [menu], view: small, measure })
    expect(at.box.top).toBeGreaterThanOrEqual(small.top)
    expect(at.box.bottom).toBeLessThanOrEqual(small.bottom)
  })
})
