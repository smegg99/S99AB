// web/tests/texture-files.spec.ts

import { readdirSync, readFileSync } from 'node:fs'
import { basename, resolve } from 'node:path'
import { describe, expect, it } from 'vitest'

// Checks that each SVG is usable as a mask; every failure here is silent in the browser.
// Resolved from the project root, since import.meta.url is an http URL under happy-dom.
const dir = resolve(process.cwd(), 'public/textures')

const files = readdirSync(dir)
  .filter(name => name.endsWith('.svg'))
  .map(name => basename(name, '.svg'))
  .sort()

function source(name: string): string {
  return readFileSync(resolve(dir, `${name}.svg`), 'utf8')
}

describe('texture files', () => {
  it('has files to check', () => {
    expect(files.length).toBeGreaterThan(0)
  })

  // A malformed SVG masks to nothing. Two hyphens end an XML comment, so a custom
  // property named in one breaks the file.
  it.each(files)('%s is well-formed XML', (name) => {
    const doc = new DOMParser().parseFromString(source(name), 'image/svg+xml')

    expect(
      doc.querySelector('parsererror')?.textContent ?? '',
      `${name}.svg does not parse`,
    ).toBe('')
    expect(doc.documentElement.tagName.toLowerCase()).toBe('svg')
  })

  it.each(files)('%s declares a square viewBox', (name) => {
    const box = source(name).match(/viewBox="0 0 ([\d.]+) ([\d.]+)"/)

    expect(box, `${name}.svg has no viewBox starting at the origin`).not.toBeNull()
    expect(box![1]).toBe(box![2])
  })

  it.each(files)('%s runs no script and references nothing external', (name) => {
    const svg = source(name)

    expect(svg).not.toMatch(/<script/i)
    expect(svg).not.toMatch(/(?:xlink:)?href="(?:https?:)?\/\//i)
  })

  it.each(files)('%s stitches its turbulence, if it has any', (name) => {
    const svg = source(name)
    if (!svg.includes('feTurbulence')) return

    // Without this every tile boundary is a visible seam.
    expect(svg).toMatch(/stitchTiles="stitch"/)

    // The filter region must match the tile; the default is 10% larger on every side.
    expect(svg).toMatch(/filterUnits="userSpaceOnUse"/)
  })

  // A mask reads alpha, so a white fill is a hole.
  it.each(files)('%s paints in black rather than white', (name) => {
    expect(source(name)).not.toMatch(/(?:fill|stroke|stop-color)="(?:#fff(?:fff)?|white)"/i)
  })
})
