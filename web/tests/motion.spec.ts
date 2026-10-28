// web/tests/motion.spec.ts

import { defineComponent, h, nextTick } from 'vue'
import { mount } from '@vue/test-utils'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import Motion from '../src/components/motion/Motion.vue'
import { useMotion } from '../src/composables/motion/useMotion'
import { applyMotionLevel, configureMotion, prefersReducedMotion, resetMotion, resolveLevel } from '../src/composables/motion/internal/motion'

/** Stubs the OS preference, which happy-dom does not implement. */
function stubPrefersReduced(reduce: boolean) {
  vi.stubGlobal('matchMedia', (query: string) => ({
    matches: reduce && query.includes('prefers-reduced-motion'),
    media: query,
    addEventListener() {},
    removeEventListener() {},
  }))
}

beforeEach(() => {
  resetMotion()
  document.documentElement.removeAttribute('data-motion')
})

afterEach(() => {
  vi.unstubAllGlobals()
})

describe('level resolution', () => {
  it('passes an explicit level through untouched', () => {
    expect(resolveLevel('full')).toBe('full')
    expect(resolveLevel('reduced')).toBe('reduced')
    expect(resolveLevel('off')).toBe('off')
  })

  it('resolves system to full when the OS has no preference', () => {
    stubPrefersReduced(false)
    expect(resolveLevel('system')).toBe('full')
  })

  // The OS preference applies without the user configuring anything.
  it('resolves system to reduced when the OS asks for it', () => {
    stubPrefersReduced(true)
    expect(resolveLevel('system')).toBe('reduced')
  })

  it('reports no preference where matchMedia is absent', () => {
    vi.stubGlobal('matchMedia', undefined)
    expect(prefersReducedMotion()).toBe(false)
    expect(resolveLevel('system')).toBe('full')
  })
})

describe('applying the level', () => {
  // CSS keys off this attribute, so changing the level needs no rerender.
  it('writes the level onto the document root', () => {
    applyMotionLevel('reduced')
    expect(document.documentElement.dataset.motion).toBe('reduced')
  })

  it('writes the unresolved level, so CSS can answer system itself', () => {
    applyMotionLevel('system')
    expect(document.documentElement.dataset.motion).toBe('system')
  })

  it('setLevel updates both the config and the document', () => {
    const { setLevel, level } = useMotion()
    setLevel('off')

    expect(level.value).toBe('off')
    expect(document.documentElement.dataset.motion).toBe('off')
  })
})

describe('transition names', () => {
  it('prefixes a preset', () => {
    const { setLevel, nameFor } = useMotion()
    setLevel('full')

    expect(nameFor('fade')).toBe('motion-fade')
    expect(nameFor('slide-up')).toBe('motion-slide-up')
  })

  // Reduced keeps names; CSS removes the travel.
  it('keeps names under reduced', () => {
    const { setLevel, nameFor } = useMotion()
    setLevel('reduced')

    expect(nameFor('fade')).toBe('motion-fade')
  })

  it('returns an empty name when off', () => {
    const { setLevel, nameFor } = useMotion()
    setLevel('off')

    expect(nameFor('fade')).toBe('')
  })
})

describe('config merging', () => {
  it('merges a partial duration map rather than replacing it', () => {
    configureMotion({ duration: { base: 500 } })
    const { config } = useMotion()

    expect(config.duration.base).toBe(500)
    expect(config.duration.fast).toBe(120)
    expect(config.duration.slow).toBe(320)
  })

  it('merges a partial easing map rather than replacing it', () => {
    configureMotion({ easing: { standard: 'linear' } })
    const { config } = useMotion()

    expect(config.easing.standard).toBe('linear')
    expect(config.easing.enter).toBe('cubic-bezier(0,0,0,1)')
  })

  it('takes a level without touching the maps', () => {
    configureMotion({ level: 'reduced' })
    const { config } = useMotion()

    expect(config.level).toBe('reduced')
    expect(config.duration.base).toBe(200)
  })
})

// The module subscribes to matchMedia changes at load, so these stub matchMedia
// and import it fresh.
describe('the OS changing its mind', () => {
  async function withReducedMotionQuery(asks: () => boolean) {
    const listeners: Array<() => void> = []

    vi.stubGlobal('matchMedia', (query: string) => ({
      get matches() {
        return asks() && query.includes('prefers-reduced-motion')
      },
      media: query,
      addEventListener(_: string, fn: () => void) {
        listeners.push(fn)
      },
      removeEventListener() {},
    }))

    vi.resetModules()
    const motion = await import('../src/composables/motion/useMotion')
    return { motion, fire: () => listeners.forEach(fn => fn()) }
  }

  it('re-resolves system when the query fires a change', async () => {
    let asks = false
    const { motion, fire } = await withReducedMotionQuery(() => asks)
    const { resolved } = motion.useMotion()

    expect(resolved.value).toBe('full')

    asks = true
    fire()

    expect(resolved.value).toBe('reduced')
  })

  it('goes back to full when the OS stops asking', async () => {
    let asks = true
    const { motion, fire } = await withReducedMotionQuery(() => asks)
    const { resolved } = motion.useMotion()

    expect(resolved.value).toBe('reduced')

    asks = false
    fire()

    expect(resolved.value).toBe('full')
  })
})

describe('UiMotion', () => {
  function mountMotion(props: Record<string, unknown> = {}) {
    return mount(defineComponent({
      setup: () => () => h(Motion, props, { default: () => h('p', { class: 'child' }, 'hello') }),
    }))
  }

  it('renders its children', () => {
    expect(mountMotion().find('.child').exists()).toBe(true)
  })

  // An empty-named Transition still adds v-enter classes, so off renders no Transition.
  it('renders no Transition when motion is off', async () => {
    useMotion().setLevel('off')
    await nextTick()

    const wrapper = mountMotion()
    expect(wrapper.findComponent({ name: 'Transition' }).exists()).toBe(false)
    expect(wrapper.find('.child').exists()).toBe(true)
  })

  it('still renders children under reduced', async () => {
    useMotion().setLevel('reduced')
    await nextTick()

    expect(mountMotion().find('.child').exists()).toBe(true)
  })

  it('renders a group for a list', async () => {
    useMotion().setLevel('full')
    await nextTick()

    const wrapper = mountMotion({ group: true, tag: 'ul' })
    expect(wrapper.find('.child').exists()).toBe(true)
  })
})
