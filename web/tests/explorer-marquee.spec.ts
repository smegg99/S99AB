// web/tests/explorer-marquee.spec.ts

import { describe, expect, it } from 'vitest'
import { covered } from '../src/composables/explorer/internal/marquee'
import { TILE_ATTR } from '../src/composables/explorer/internal/keys'

/** A grid of tiles at given boxes; happy-dom has no layout, so the geometry is fed directly. */
function grid(boxes: Record<string, [number, number, number, number]>): HTMLElement {
  const el = document.createElement('div')

  for (const [id, [left, top, right, bottom]] of Object.entries(boxes)) {
    const tile = document.createElement('div')
    tile.setAttribute(TILE_ATTR, id)
    tile.getBoundingClientRect = () => ({
      left,
      top,
      right,
      bottom,
      width: right - left,
      height: bottom - top,
      x: left,
      y: top,
      toJSON: () => ({}),
    })
    el.append(tile)
  }
  return el
}

// Two tiles side by side, and one on the row below.
const TILES = {
  a: [0, 0, 100, 100] as [number, number, number, number],
  b: [120, 0, 220, 100] as [number, number, number, number],
  c: [0, 120, 100, 220] as [number, number, number, number],
}

describe('what a rubber band covers', () => {
  // A tile is taken as soon as the band touches it.
  it('takes every tile it touches, however little of it', () => {
    const ids = covered(grid(TILES), { left: 90, top: 90, right: 130, bottom: 130 })

    expect(ids.sort()).toEqual(['a', 'b', 'c'])
  })

  it('takes nothing from the space between them', () => {
    const ids = covered(grid(TILES), { left: 105, top: 105, right: 115, bottom: 115 })

    expect(ids).toEqual([])
  })

  it('takes a row without the row below it', () => {
    const ids = covered(grid(TILES), { left: 0, top: 0, right: 300, bottom: 100 })

    expect(ids).toEqual(['a', 'b'])
  })

  // The up placeholder carries the marker without an id: focusable, never picked.
  it('skips a marker with no node behind it', () => {
    const el = grid({ a: TILES.a })
    const up = document.createElement('div')
    up.setAttribute(TILE_ATTR, '')
    up.getBoundingClientRect = () => new DOMRect(0, 0, 100, 100)
    el.prepend(up)

    expect(covered(el, { left: 0, top: 0, right: 300, bottom: 300 })).toEqual(['a'])
  })
})
