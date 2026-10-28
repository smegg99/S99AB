// web/tests/tab-title.spec.ts
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'
import { flushPromises, mount, type VueWrapper } from '@vue/test-utils'
import { defineComponent, h, nextTick, reactive } from 'vue'
import TabStrip from '../src/components/tabs/TabStrip.vue'
import Explorer from '../src/components/explorer/Explorer.vue'
import UiDisabledHint from '../src/components/primitives/DisabledHint.vue'
import { disposeExplorer, useExplorer } from '../src/composables/explorer/useExplorer'
import { configureExplorer } from '../src/composables/explorer/internal/config'
import type { ExplorerNode } from '../src/composables/explorer/internal/tree'
import { titleWords } from '../src/composables/tabs/internal/titleWords'
import type { WorkspaceTab } from '../src/composables/tabs/useTabs'
import { vuetifyWith } from './mount'

// A tab title too long for its tab ends after a whole word ("Quarterly - Rep...").
// Its tooltip is one of the window's explaining tooltips, of which one stands open at a time.

const vuetify = vuetifyWith({ defaults: { VTooltip: { openDelay: 0, closeDelay: 0, transition: false } } })
beforeAll(() => {
  vi.stubGlobal('visualViewport', null)
})
afterAll(() => {
  vi.unstubAllGlobals()
})
const mounted: VueWrapper[] = []
afterEach(() => {
  mounted.splice(0).forEach(wrapper => wrapper.unmount())
  document.body.innerHTML = ''
})

/** A disabled control elsewhere in the window, its reason open by the keyboard's focus. */
async function reasonOpen() {
  const wrapper = mount(defineComponent({
    render: () => h(UiDisabledHint, { reason: 'Not available yet', label: 'Export' }, () => h('button', { disabled: true }, 'Export')),
  }), { attachTo: document.body, global: { plugins: [vuetify] } })
  mounted.push(wrapper as VueWrapper)
  // The tooltip binds itself to its parent, the host, a tick after it mounts.
  await nextTick()
  ;(wrapper.get('.s99ab-disabled-hint').element as HTMLElement).focus()
  await vi.waitFor(() => expect(active()).toEqual(['Not available yet']))
}

const active = () => [...document.querySelectorAll('.v-tooltip.v-overlay--active')].map(el => el.textContent?.trim())

describe('a tab title\'s words', () => {
  it('keeps a separator standing alone with the word after it, so a cut never ends on it', () => {
    expect(titleWords('Plan lekcji - Plan 2027')).toEqual(['Plan', 'lekcji', '-\u00a0Plan', '2027'])
    expect(titleWords('Oddziały · Plan 2027')).toEqual(['Oddziały', '·\u00a0Plan', '2027'])
    expect(titleWords('Plan 2027 -')).toEqual(['Plan', '2027\u00a0-'])
    expect(titleWords('Home')).toEqual(['Home'])
    expect(titleWords('-')).toEqual(['-'])
    expect(titleWords('')).toEqual([])
  })

  it('draws each word after the first as a box the ellipsis takes whole, the whole title read as it is', () => {
    const wrapper = renderStrip('Plan lekcji - Plan 2027')
    const title = wrapper.get('#tab-one .tab__title')
    expect(title.findAll('span').map(span => [span.text(), span.classes('tab__word')])).toEqual([
      ['Plan', false],
      ['lekcji', true],
      ['-\u00a0Plan', true],
      ['2027', true],
    ])
    expect(title.text().replace(/\u00a0/g, ' ')).toBe('Plan lekcji - Plan 2027')
  })
})

function renderStrip(title: string) {
  const ws = reactive({
    tabs: [{ id: 'home', pinned: true }, { id: 'one' }] as WorkspaceTab[],
    activeId: 'one',
    move: vi.fn(),
    activate: vi.fn(),
    close: vi.fn(),
  })
  const titleOf = (tab: WorkspaceTab) => (tab.id === 'one' ? title : 'Home')
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
  return wrapper
}

describe('one explaining tooltip at a time', () => {
  it('closes a reason the keyboard opened elsewhere as a tab\'s title opens, standing alone', async () => {
    await reasonOpen()
    const wrapper = renderStrip('Lessons')
    await nextTick()
    await wrapper.get('#tab-one').trigger('mouseenter')
    await vi.waitFor(() => expect(active()).toEqual(['Lessons']))
  })

  describe('in the explorer\'s bar', () => {
    beforeEach(() => {
      disposeExplorer()
      configureExplorer({ behaviour: { activate: 'double', select: 'multi', springOpen: 600, keyboard: true } })
    })

    it('closes a reason the keyboard opened elsewhere as the new folder key\'s tooltip opens', async () => {
      await reasonOpen()
      const seed: ExplorerNode[] = [{ id: 'docs', parentId: null, kind: 'folder', name: 'Docs', position: 0 }]
      const explorer = useExplorer({ load: () => Promise.resolve(seed), createFolder: () => Promise.resolve() })
      const wrapper = mount(Explorer, { props: { explorer }, attachTo: document.body, global: { plugins: [vuetify] } })
      mounted.push(wrapper as VueWrapper)
      await flushPromises()
      const create = wrapper.findAll('.s99ab-explorer__actions button').at(-1)!
      await create.trigger('mouseenter')
      await vi.waitFor(() => expect(active()).toHaveLength(1))
      expect(active()[0]).not.toBe('Not available yet')
    })
  })
})
