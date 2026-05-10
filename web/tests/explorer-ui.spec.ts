// web/tests/explorer-ui.spec.ts

import { createVuetify } from 'vuetify'
import * as components from 'vuetify/components'
import * as directives from 'vuetify/directives'
import { h, nextTick } from 'vue'
import { flushPromises, mount } from '@vue/test-utils'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import Explorer from '../src/components/explorer/Explorer.vue'
import EmptyState from '../src/components/state/EmptyState.vue'
import ErrorState from '../src/components/state/ErrorState.vue'
import {
  type ExplorerApi,
  disposeExplorer,
  useExplorer,
} from '../src/composables/explorer/useExplorer'
import { configureExplorer } from '../src/composables/explorer/useExplorerConfig'
import type { ExplorerNode } from '../src/composables/explorer/useExplorerTree'

const vuetify = createVuetify({ components, directives })

// docs
// +-- nested   (folder, empty)
// +-- note     (item)
// photo        (item)
function seed(): ExplorerNode[] {
  return [
    {
      id: 'docs',
      parentId: null,
      kind: 'folder',
      name: 'Docs',
      position: 0,
      accent: 'blue',
    },
    {
      id: 'nested',
      parentId: 'docs',
      kind: 'folder',
      name: 'Nested',
      position: 0,
    },
    { id: 'note', parentId: 'docs', kind: 'item', name: 'Note', position: 0 },
    { id: 'photo', parentId: null, kind: 'item', name: 'Photo', position: 0 },
  ]
}

function mountExplorer(
  explorer: ExplorerApi,
  slots: Record<string, unknown> = {},
) {
  return mount(Explorer, {
    props: { explorer },
    slots: slots as never,
    global: { plugins: [vuetify] },
  })
}

beforeEach(() => {
  disposeExplorer()
  // Restores the layer defaults so a test's tuning does not leak.
  configureExplorer({
    behaviour: { activate: 'double', select: 'multi', springOpen: 600, keyboard: true },
  })
})

describe('UiExplorer', () => {
  it('loads on mount and renders one tile per child', async () => {
    const explorer = useExplorer({ load: () => Promise.resolve(seed()) })
    const wrapper = mountExplorer(explorer)
    await flushPromises()

    const tiles = wrapper.findAll('.s99ab-tile')
    expect(tiles).toHaveLength(2)
    expect(tiles[0]!.text()).toContain('Docs')
    // The folder carries its tint. The default icon view has no count chip.
    expect(tiles[0]!.attributes('data-accent')).toBe('blue')
    expect(wrapper.find('.s99ab-explorer').attributes('data-tile-variant')).toBe('icon')
  })

  // Double click by default; the next test covers the single-click option.
  it('browses into a folder on a double click and shows the way back out', async () => {
    const explorer = useExplorer({ load: () => Promise.resolve(seed()) })
    const wrapper = mountExplorer(explorer)
    await flushPromises()

    await wrapper.findAll('.s99ab-tile')[0]!.trigger('dblclick')

    expect(explorer.currentId.value).toBe('docs')
    expect(wrapper.find('.s99ab-tile--up').exists()).toBe(true)
    expect(wrapper.findAll('.s99ab-tile')).toHaveLength(3)
  })

  it('opens on one click where the app asked for one', async () => {
    configureExplorer({ behaviour: { activate: 'single', select: 'none' } })
    const explorer = useExplorer({ load: () => Promise.resolve(seed()) })
    const wrapper = mountExplorer(explorer)
    await flushPromises()

    await wrapper.findAll('.s99ab-tile')[0]!.trigger('click')

    expect(explorer.currentId.value).toBe('docs')
  })

  it('emits open for a leaf rather than navigating into it', async () => {
    const explorer = useExplorer({ load: () => Promise.resolve(seed()) })
    const wrapper = mountExplorer(explorer)
    await flushPromises()

    await wrapper.findAll('.s99ab-tile')[1]!.trigger('dblclick')

    expect(explorer.currentId.value).toBeNull()
    expect(wrapper.emitted('open')?.[0]).toEqual([
      expect.objectContaining({ id: 'photo' }),
    ])
  })

  it('renders the path, with the open folder last', async () => {
    const explorer = useExplorer({ load: () => Promise.resolve(seed()) })
    const wrapper = mountExplorer(explorer)
    await flushPromises()
    explorer.navigate('docs')
    await nextTick()

    const crumbs = wrapper.findAll('.s99ab-explorer__crumb')
    expect(crumbs).toHaveLength(2)
    expect(crumbs[1]!.text()).toContain('Docs')
    expect(crumbs[1]!.classes()).toContain('s99ab-explorer__crumb--current')
  })

  it('shows the empty state in a folder with nothing in it', async () => {
    const explorer = useExplorer({ load: () => Promise.resolve(seed()) })
    const wrapper = mountExplorer(explorer)
    await flushPromises()
    explorer.navigate('nested')
    await nextTick()

    expect(wrapper.findComponent(EmptyState).exists()).toBe(true)
    // The up tile still renders in an empty folder.
    expect(wrapper.find('.s99ab-tile--up').exists()).toBe(true)
  })

  it('replaces every tile through the slot, keeping them keyed in the group', async () => {
    const explorer = useExplorer({ load: () => Promise.resolve(seed()) })
    const wrapper = mountExplorer(explorer, {
      tile: ({ node }: { node: ExplorerNode }) =>
        h('div', { class: 'custom-tile' }, node.name),
    })
    await flushPromises()

    const custom = wrapper.findAll('.custom-tile')
    expect(custom).toHaveLength(2)
    expect(custom.map(c => c.text())).toEqual(['Docs', 'Photo'])
    expect(wrapper.find('.s99ab-tile').exists()).toBe(false)
  })

  it('offers no drag and no folder actions when the source only loads', async () => {
    const explorer = useExplorer({ load: () => Promise.resolve(seed()) })
    const wrapper = mountExplorer(explorer)
    await flushPromises()

    expect(wrapper.find('.s99ab-tile').attributes('draggable')).toBe('false')
    expect(
      wrapper.find('.s99ab-explorer__actions').findAll('button'),
    ).toHaveLength(0)
    // No actions, so no ... trigger.
    expect(wrapper.find('.s99ab-tile__more').exists()).toBe(false)
  })

  it('offers drag and a folder menu when the source implements them', async () => {
    const explorer = useExplorer({
      load: () => Promise.resolve(seed()),
      move: () => Promise.resolve(),
      createFolder: () => Promise.resolve(),
      deleteFolder: () => Promise.resolve(),
    })
    const wrapper = mountExplorer(explorer)
    await flushPromises()

    expect(wrapper.find('.s99ab-tile').attributes('draggable')).toBe('true')
    expect(
      wrapper.find('.s99ab-explorer__actions').findAll('button').length,
    ).toBeGreaterThan(0)
    // The folder has entries; the leaf beside it has none of its own.
    expect(wrapper.findAll('.s99ab-tile__more')).toHaveLength(1)
  })

  // The tile leaves the DOM, not only the state. happy-dom runs no transitions,
  // so this covers the state-to-DOM half.
  it('removes a tile that a drag moved out of the open folder', async () => {
    const explorer = useExplorer({
      load: () => Promise.resolve(seed()),
      move: () => Promise.resolve(),
    })
    const wrapper = mountExplorer(explorer)
    await flushPromises()
    expect(wrapper.findAll('.s99ab-tile')).toHaveLength(2)

    explorer.drag.begin(explorer.children.value[1]!) // photo
    explorer.drag.dropInto('docs')
    await flushPromises()

    expect(explorer.children.value).toHaveLength(1)
    expect(wrapper.findAll('.s99ab-tile')).toHaveLength(1)
  })

  // The skeleton has the grid's shape, and nothing shows before the threshold.
  it('holds the grid shape while the tree loads, and shows nothing before that', async () => {
    vi.useFakeTimers()
    let arrive: (nodes: ExplorerNode[]) => void = () => {}
    const explorer = useExplorer({
      load: () =>
        new Promise<ExplorerNode[]>((resolve) => {
          arrive = resolve
        }),
    })
    const wrapper = mountExplorer(explorer)
    await nextTick()

    // Under the appear threshold nothing is drawn.
    expect(wrapper.find('.s99ab-tile--skeleton').exists()).toBe(false)

    vi.advanceTimersByTime(300)
    await nextTick()
    expect(wrapper.findAll('.s99ab-tile--skeleton').length).toBeGreaterThan(0)
    expect(wrapper.find('.s99ab-explorer__grid').exists()).toBe(true)

    arrive(seed())
    await flushPromises()
    vi.advanceTimersByTime(600)
    await nextTick()

    expect(wrapper.find('.s99ab-tile--skeleton').exists()).toBe(false)
    expect(wrapper.findAll('.s99ab-tile')).toHaveLength(2)
    vi.useRealTimers()
  })

  it('shows a failed load with a retry instead of an empty grid', async () => {
    const explorer = useExplorer({
      load: () => Promise.reject(new Error('offline')),
    })
    const wrapper = mountExplorer(explorer)
    await flushPromises()

    expect(wrapper.findComponent(ErrorState).exists()).toBe(true)
    expect(wrapper.find('.s99ab-explorer__grid').exists()).toBe(false)
  })
})
