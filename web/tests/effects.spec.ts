// web/tests/effects.spec.ts

import { defineComponent, h } from 'vue'
import { mount } from '@vue/test-utils'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { configureMotion, resetMotion } from '../src/composables/motion/useMotion'
import {
  applyLite,
  configureEffects,
  resetEffects,
  useEffects,
} from '../src/composables/appearance/useEffects'

const KEY = 's99ab.effects'

/** Mounts a throwaway component so useEffects' onMounted restore runs. */
function mountEffects() {
  const seen: ReturnType<typeof useEffects>[] = []
  const Comp = defineComponent({
    setup() {
      seen.push(useEffects())
      return () => h('div')
    },
  })
  const wrapper = mount(Comp)
  return { api: seen[0]!, wrapper }
}

beforeEach(() => {
  resetMotion()
  resetEffects()
  localStorage.clear()
  document.documentElement.removeAttribute('data-s99ab-lite')
  document.documentElement.removeAttribute('data-motion')
})

afterEach(() => {
  localStorage.clear()
})

describe('applyLite', () => {
  it('sets the attribute and stops motion when on', () => {
    applyLite(true)
    expect(document.documentElement.hasAttribute('data-s99ab-lite')).toBe(true)
    expect(document.documentElement.dataset.motion).toBe('off')
  })

  it('removes the attribute and restores the base motion when off', () => {
    applyLite(true)
    applyLite(false)
    expect(document.documentElement.hasAttribute('data-s99ab-lite')).toBe(false)
    // Base is the configured level: system by default.
    expect(document.documentElement.dataset.motion).toBe('system')
  })

  it('restores an explicit motion level rather than system', () => {
    configureMotion({ level: 'reduced' })
    applyLite(true)
    expect(document.documentElement.dataset.motion).toBe('off')
    applyLite(false)
    expect(document.documentElement.dataset.motion).toBe('reduced')
  })
})

describe('useEffects restore on mount', () => {
  it('takes the app default when nothing is stored', () => {
    configureEffects({ storageKey: KEY, liteDefault: true })
    const { api } = mountEffects()
    expect(api.lite.value).toBe(true)
    expect(api.effects.value).toBe(false)
    expect(document.documentElement.hasAttribute('data-s99ab-lite')).toBe(true)
  })

  it('lets a stored choice override the default', () => {
    configureEffects({ storageKey: KEY, liteDefault: true })
    localStorage.setItem(KEY, 'full')
    const { api } = mountEffects()
    expect(api.lite.value).toBe(false)
    expect(api.effects.value).toBe(true)
    expect(document.documentElement.hasAttribute('data-s99ab-lite')).toBe(false)
  })
})

describe('toggling persists', () => {
  it('setEffects writes the inverse and flips the document', () => {
    configureEffects({ storageKey: KEY, liteDefault: true })
    const { api } = mountEffects()

    api.setEffects(true)
    expect(api.effects.value).toBe(true)
    expect(localStorage.getItem(KEY)).toBe('full')
    expect(document.documentElement.hasAttribute('data-s99ab-lite')).toBe(false)

    api.toggleEffects()
    expect(api.effects.value).toBe(false)
    expect(localStorage.getItem(KEY)).toBe('lite')
    expect(document.documentElement.hasAttribute('data-s99ab-lite')).toBe(true)
  })

  it('two readers share one state', () => {
    configureEffects({ storageKey: KEY, liteDefault: true })
    const a = mountEffects().api
    const b = mountEffects().api
    a.setEffects(true)
    expect(b.effects.value).toBe(true)
  })
})
