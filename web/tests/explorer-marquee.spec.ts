// web/tests/explorer-marquee.spec.ts

import { effectScope } from 'vue'
import { describe, expect, it } from 'vitest'
import { covered, useExplorerMarquee } from '../src/composables/explorer/internal/marquee'
import { TILE_ATTR } from '../src/browser/tiles'

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

describe('the band', () => {
  function pressGrid() {
    const grid = document.createElement('div')
    document.body.append(grid)
    const scope = effectScope()
    const covers: string[][] = []
    const marquee = scope.run(() => useExplorerMarquee({ enabled: () => true, clear: () => {}, cover: ids => covers.push(ids) }))!
    grid.addEventListener('pointerdown', marquee.onPointerdown)
    grid.dispatchEvent(new PointerEvent('pointerdown', { button: 0, clientX: 5, clientY: 5, bubbles: true }))
    const done = () => {
      scope.stop()
      grid.remove()
    }
    return { marquee, covers, done }
  }

  it('follows the pointer and ends on Escape', () => {
    const { marquee, done } = pressGrid()
    window.dispatchEvent(new PointerEvent('pointermove', { buttons: 1, clientX: 40, clientY: 30 }))
    expect(marquee.band.value).toMatchObject({ width: 35, height: 25 })
    window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }))
    expect(marquee.band.value).toBeNull()
    done()
  })

  it('ends when the release happened outside the window', () => {
    const { marquee, done } = pressGrid()
    window.dispatchEvent(new PointerEvent('pointermove', { buttons: 1, clientX: 40, clientY: 30 }))
    window.dispatchEvent(new PointerEvent('pointermove', { buttons: 0, clientX: 60, clientY: 60 }))
    expect(marquee.band.value).toBeNull()
    done()
  })
})
