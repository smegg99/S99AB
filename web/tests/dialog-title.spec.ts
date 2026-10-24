// web/tests/dialog-title.spec.ts

import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'

// A long title wraps between words instead of being cut. The rule lives in the stylesheet.
describe('a dialog title', () => {
  const sheet = readFileSync(resolve(process.cwd(), 'src/styles/_overlays.scss'), 'utf8')

  it('wraps between its words in the head strip', () => {
    const match = sheet.match(/\.s99ab-dialog\.panel > \.panel__head > \.panel__title\s*\{([^}]*)\}/)
    expect(match?.[1]).toContain('white-space: normal')
    expect(match?.[1]).toContain('overflow-wrap: break-word')
  })
})
