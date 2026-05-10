// web/tests/autoheight.spec.ts

import { mount } from '@vue/test-utils'
import { defineComponent, h, nextTick, ref } from 'vue'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import AutoHeight from '../src/components/motion/AutoHeight.vue'
import { configureMotion } from '../src/composables/motion/useMotion'

function setMotionLevel(level: 'full' | 'off') {
  configureMotion({ level })
}

// happy-dom has no layout: content height is stubbed and the observer driven by hand.
let trigger: (() => void) | undefined
let contentHeight = 100

class FakeResizeObserver {
  constructor(private cb: () => void) {
    trigger = () => this.cb()
  }

  observe() {}
  disconnect() {}
}

function heightOf(wrapper: { attributes: (name: string) => string | undefined }) {
  const style = wrapper.attributes('style') ?? ''
  return /height:\s*(\d+)px/.exec(style)?.[1]
}

beforeEach(() => {
  contentHeight = 100
  vi.stubGlobal('ResizeObserver', FakeResizeObserver)
  vi.spyOn(Element.prototype, 'getBoundingClientRect').mockImplementation(
    () => ({ height: contentHeight }) as DOMRect,
  )
})

afterEach(() => {
  vi.unstubAllGlobals()
  vi.restoreAllMocks()
})

describe('UiAutoHeight', () => {
  it('takes the height of its content on mount', async () => {
    const wrapper = mount(AutoHeight)
    await nextTick()
    expect(heightOf(wrapper)).toBe('100')
  })

  it('follows the content up', async () => {
    const wrapper = mount(AutoHeight)
    await nextTick()

    contentHeight = 480
    trigger!()
    await nextTick()

    expect(heightOf(wrapper)).toBe('480')
  })

  // Shrinking must follow the content down too.
  it('follows the content down', async () => {
    const wrapper = mount(AutoHeight)
    await nextTick()

    contentHeight = 480
    trigger!()
    await nextTick()
    expect(heightOf(wrapper)).toBe('480')

    contentHeight = 120
    trigger!()
    await nextTick()

    expect(heightOf(wrapper)).toBe('120')
  })

  it('goes to nothing when the content does', async () => {
    const wrapper = mount(AutoHeight)
    await nextTick()

    contentHeight = 0
    trigger!()
    await nextTick()

    expect(heightOf(wrapper)).toBe('0')
  })
})

// measure() is exposed for changes no observer reports (a web font, a parent unhiding it).
describe('measuring on demand', () => {
  it('takes the height again when the caller asks, with no observer involved', async () => {
    // Reached through a template ref, the way a caller has it.
    const box = ref<{ measure: () => void } | null>(null)
    const wrapper = mount(defineComponent({
      setup: () => () => h(AutoHeight, { ref: box }),
    }))
    await nextTick()
    expect(heightOf(wrapper.find('.autoheight'))).toBe('100')

    // No trigger(): the call alone must update the height.
    contentHeight = 260
    box.value!.measure()
    await nextTick()

    expect(heightOf(wrapper.find('.autoheight'))).toBe('260')
  })
})

describe('what leaves', () => {
  // Vue removes outgoing nodes before the box moves, so a copy is held while it closes.
  it('is held on screen while the box closes on it', async () => {
    const rows = ref(3)
    const wrapper = mount(defineComponent({
      setup: () => () => h(AutoHeight, null, {
        default: () => rows.value ? [h('div', 'row')] : [],
      }),
    }))
    await nextTick()

    contentHeight = 40
    rows.value = 0
    await nextTick()

    const ghost = wrapper.find('.autoheight__ghost')
    expect(ghost.attributes('hidden')).toBeUndefined()
    expect(ghost.text()).toContain('row')
    // The copy is inert.
    expect(ghost.attributes('aria-hidden')).toBe('true')
  })

  // Growth reveals new content through the clip, so no copy is needed.
  it('is not held when the box is growing', async () => {
    const rows = ref(1)
    const wrapper = mount(defineComponent({
      setup: () => () => h(AutoHeight, null, {
        default: () => Array.from({ length: rows.value }, () => h('div', 'row')),
      }),
    }))
    await nextTick()

    contentHeight = 400
    rows.value = 6
    await nextTick()

    expect(wrapper.find('.autoheight__ghost').attributes('hidden')).toBeDefined()
  })

  it('keeps no copy when motion is off', async () => {
    setMotionLevel('off')
    const rows = ref(3)
    const wrapper = mount(defineComponent({
      setup: () => () => h(AutoHeight, null, {
        default: () => rows.value ? [h('div', 'row')] : [],
      }),
    }))
    await nextTick()

    contentHeight = 0
    rows.value = 0
    await nextTick()

    expect(wrapper.find('.autoheight__ghost').attributes('hidden')).toBeDefined()
    setMotionLevel('full')
  })
})

describe('who sets the speed', () => {
  // A preset with its own timing drives the box; an inline token would override
  // the preset's stylesheet rule.
  it('leaves the duration to CSS when no token is named', async () => {
    const wrapper = mount(AutoHeight)
    await nextTick()

    expect(wrapper.attributes('style') ?? '').not.toContain('--autoheight-duration')
  })

  it('states it inline when a token is named, so it wins', async () => {
    const wrapper = mount(AutoHeight, { props: { motion: 'slow' } })
    await nextTick()

    expect(wrapper.attributes('style')).toContain('--autoheight-duration: var(--s99ab-motion-slow)')
  })
})
