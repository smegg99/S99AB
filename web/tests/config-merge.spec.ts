// web/tests/config-merge.spec.ts

import { describe, expect, it } from 'vitest'
import { mergeConfig } from '../src/internal/config'

describe('mergeConfig', () => {
  it('sets plain keys and merges the nested maps one level down', () => {
    const config = { level: 'system', duration: { fast: 120, base: 200 }, easing: { standard: 'a' } }
    mergeConfig(config, { level: 'off', duration: { fast: 80 } }, ['duration', 'easing'])
    expect(config).toEqual({ level: 'off', duration: { fast: 80, base: 200 }, easing: { standard: 'a' } })
  })

  it('leaves a key alone when the patch has it undefined', () => {
    const config = { level: 'full', duration: { fast: 120 } }
    mergeConfig(config, { level: undefined }, ['duration'])
    expect(config.level).toBe('full')
  })

  it('keeps the live nested object, so readers holding it see the change', () => {
    const config = { duration: { fast: 120 } }
    const held = config.duration
    mergeConfig(config, { duration: { fast: 60 } }, ['duration'])
    expect(held.fast).toBe(60)
  })
})
