// web/tests/tab-strip.spec.ts
import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from 'vitest'
import { mount, type VueWrapper } from '@vue/test-utils'
import { reactive } from 'vue'
import { createVuetify } from 'vuetify'
import * as components from 'vuetify/components'
import TabStrip from '../src/components/tabs/TabStrip.vue'
import type { WorkspaceTab } from '../src/composables/tabs/useTabs'

const titles: Record<string, string> = { home: 'Home', one: 'Lessons' }
const titleOf = (tab: WorkspaceTab) => titles[tab.id] ?? ''

const vuetify = createVuetify({ components, defaults: { VTooltip: { openDelay: 0, closeDelay: 0, transition: false } } })
// Happy DOM has no visual viewport; Vuetify supports the browser's null case.
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

function render(moving: boolean) {
  const ws = reactive({
    tabs: [{ id: 'home', pinned: true }, { id: 'one', moving }] as WorkspaceTab[],
    activeId: 'one',
    move: vi.fn(),
    activate: vi.fn(),
    close: vi.fn(),
  })
  const wrapper = mount(TabStrip, {
    props: {
      workspace: ws,
      titleOf,
      iconOf: () => 'mdi-file-outline',
      tintOf: () => undefined,
      tabsLabel: 'Tabs',
      closeLabel: (tab: WorkspaceTab) => `Close ${titleOf(tab)}`,
      movingReason: 'Moving tab',
      tabMenu: () => [],
      stripMenu: () => [],
    },
    attachTo: document.body,
    global: { plugins: [vuetify] },
  })
  mounted.push(wrapper as VueWrapper)
  return { wrapper, ws, tab: wrapper.get('#tab-one'), host: wrapper.get('#tab-one .s99ab-disabled-hint'), cross: wrapper.get('#tab-one .tab__close') }
}

describe('tab strip close', () => {
  it('keeps a moving tab and explains its disabled cross', async () => {
    const { ws, tab, host, cross } = render(true)
    expect(cross.attributes('disabled')).toBeDefined()
    expect(host.attributes('tabindex')).toBe('0')
    expect(host.attributes('aria-label')).toBe('Close Lessons')
    await host.trigger('click')
    await cross.trigger('click')
    await tab.trigger('auxclick', { button: 1 })
    await tab.trigger('keydown', { key: 'Delete' })
    expect(ws.close).not.toHaveBeenCalled()
    expect(ws.activate).not.toHaveBeenCalled()
    await tab.trigger('mouseenter')
    await host.trigger('mouseenter')
    await vi.waitFor(() => expect(document.querySelector('.v-tooltip.v-overlay--active')?.textContent).toBe('Moving tab'))
    expect(document.querySelectorAll('.v-tooltip.v-overlay--active')).toHaveLength(1)
  })

  it('closes a tab that stays from its cross, the middle button and Delete', async () => {
    const { ws, tab, host, cross } = render(false)
    expect(cross.attributes('disabled')).toBeUndefined()
    expect(host.attributes('tabindex')).toBeUndefined()
    await cross.trigger('click')
    await tab.trigger('auxclick', { button: 1 })
    await tab.trigger('keydown', { key: 'Delete' })
    expect(ws.close).toHaveBeenCalledTimes(3)
    expect(ws.close).toHaveBeenCalledWith('one')
    expect(ws.activate).not.toHaveBeenCalled()
  })
})
