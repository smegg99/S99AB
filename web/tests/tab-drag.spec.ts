// web/tests/tab-drag.spec.ts
import { nextTick, reactive } from 'vue'
import { createVuetify } from 'vuetify'
import * as components from 'vuetify/components'
import { mount, type VueWrapper } from '@vue/test-utils'
import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from 'vitest'
import TabStrip from '../src/components/tabs/TabStrip.vue'
import type { NativeTabDrag } from '../src/composables/tabs/internal/tabDrag'
import type { WorkspaceTab } from '../src/composables/tabs/useTabs'

const vuetify = createVuetify({ components })
beforeAll(() => {
  vi.stubGlobal('visualViewport', null)
})
afterAll(() => {
  vi.unstubAllGlobals()
})
const mounted: VueWrapper[] = []
afterEach(() => {
  mounted.splice(0).forEach(wrapper => wrapper.unmount())
})

function render() {
  const ws = reactive({
    tabs: [{ id: 'home', pinned: true }, { id: 'one' }, { id: 'two' }] as WorkspaceTab[],
    activeId: 'one',
    move: vi.fn(),
    activate: vi.fn(),
    close: vi.fn(),
  })
  const native = reactive<NativeTabDrag<WorkspaceTab>>({
    dragging: '', incoming: null, closing: false, track: null,
    allowed: () => true,
    beginDrag: vi.fn(async () => {
      native.dragging = 'drag'
      return true
    }),
    cancelDrag: vi.fn(),
    tearOff: vi.fn(),
    strip: vi.fn(),
    image: vi.fn(),
  })
  const wrapper = mount(TabStrip, {
    props: {
      workspace: ws,
      titleOf: (tab: WorkspaceTab) => tab.id,
      iconOf: () => 'mdi-file-outline',
      tintOf: () => undefined,
      tabsLabel: 'Tabs',
      closeLabel: (tab: WorkspaceTab) => `Close ${tab.id}`,
      movingReason: 'Moving tab',
      tabMenu: () => [],
      stripMenu: () => [],
      native,
    },
    attachTo: document.body,
    global: { plugins: [vuetify] },
  })
  mounted.push(wrapper as VueWrapper)
  return { wrapper, native }
}

const ghost = () => document.querySelector<HTMLElement>('.ghost')
function move(x: number, y: number) {
  window.dispatchEvent(new PointerEvent('pointermove', { clientX: x, clientY: y }))
}

describe('tab drag past its window', () => {
  it('hides the pill outside the window and brings it back where the native drag says', async () => {
    const { wrapper, native } = render()
    await wrapper.get('#tab-one').trigger('pointerdown', { button: 0, clientX: 50, clientY: 10 })
    move(80, 12)
    await nextTick()
    expect(native.beginDrag).toHaveBeenCalledOnce()
    expect(native.beginDrag).toHaveBeenCalledWith(expect.objectContaining({ id: 'one' }), { title: 'one', icon: 'mdi-file-outline', tint: undefined })
    expect(ghost()).not.toBeNull()
    expect(wrapper.get('#tab-one').classes()).toContain('tab--dragged')
    expect(wrapper.get('#tab-one').classes()).not.toContain('s99ab-drop')
    expect(wrapper.emitted('update:dropping')).toBeUndefined()

    move(80, -5)
    await nextTick()
    expect(ghost()).toBeNull()
    expect(wrapper.get('#tab-one').classes()).toContain('tab--dragged')

    native.track = { inside: false, x: 0, y: 0 }
    await nextTick()
    expect(ghost()).toBeNull()
    native.track = { inside: true, x: 120, y: 14 }
    await nextTick()
    expect(ghost()?.style.transform).toBe('translate(104px, -2px)')
  })

  it('marks the window as the drop target while another window\'s tab is over it', async () => {
    const { wrapper, native } = render()
    expect(wrapper.emitted('update:dropping')).toBeUndefined()
    native.incoming = { slot: 1 }
    await nextTick()
    expect(wrapper.emitted('update:dropping')?.at(-1)).toEqual([true])
    expect(wrapper.find('.tab--incoming').classes()).toEqual(expect.arrayContaining(['s99ab-drop', 's99ab-drop--open']))
    native.incoming = null
    await nextTick()
    expect(wrapper.emitted('update:dropping')?.at(-1)).toEqual([false])
  })

  it('draws another window\'s tab in the slot with the face its window sent', async () => {
    const { wrapper, native } = render()
    native.incoming = { slot: 1, face: { title: 'Settings', icon: 'mdi-cog-outline', tint: 'green' } }
    await nextTick()
    const slot = wrapper.find('.tab--incoming')
    expect(slot.text()).toBe('Settings')
    expect(slot.attributes('data-accent')).toBe('green')
    expect(slot.find('.mdi-cog-outline').exists()).toBe(true)
    native.incoming = { slot: 1 }
    await nextTick()
    expect(wrapper.find('.tab--incoming').text()).toBe('')
    expect(wrapper.find('.tab--incoming .mdi-tab-plus').exists()).toBe(true)
  })
})
