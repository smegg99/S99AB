// web/tests/explorer-tile.spec.ts

import { createVuetify } from 'vuetify'
import * as components from 'vuetify/components'
import * as directives from 'vuetify/directives'
import { nextTick } from 'vue'
import { flushPromises, mount } from '@vue/test-utils'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import Explorer from '../src/components/explorer/Explorer.vue'
import {
  type ExplorerApi,
  disposeExplorer,
  useExplorer,
} from '../src/composables/explorer/useExplorer'
import { configureExplorer } from '../src/composables/explorer/useExplorerConfig'
import type { ExplorerNode } from '../src/composables/explorer/useExplorerTree'

const vuetify = createVuetify({ components, directives })

// docs (folder, with a cover), note (leaf, disabled), photo (leaf)
function seed(): ExplorerNode[] {
  return [
    {
      id: 'docs',
      parentId: null,
      kind: 'folder',
      name: 'Docs',
      position: 0,
      image: 'https://example.test/cover.png',
    },
    {
      id: 'note',
      parentId: null,
      kind: 'item',
      name: 'Note',
      position: 0,
      disabled: true,
      badge: 'draft',
    },
    { id: 'photo', parentId: null, kind: 'item', name: 'Photo', position: 1 },
    { id: 'inner', parentId: 'docs', kind: 'item', name: 'Inner', position: 0 },
  ]
}

// Tracked so menus' overlays are torn down; wiping innerHTML leaves Vuetify's
// scroll strategy running.
const mounted: Array<{ unmount: () => void }> = []

function mountExplorer(explorer: ExplorerApi, props: Record<string, unknown> = {}) {
  const wrapper = mount(Explorer, {
    attachTo: document.body,
    props: { explorer, ...props },
    global: { plugins: [vuetify] },
  })
  mounted.push(wrapper)
  return wrapper
}

function movable() {
  return useExplorer({
    load: () => Promise.resolve(seed()),
    move: () => Promise.resolve(),
  })
}

/** Two folders and two leaves, for the drops that need somewhere to land. */
function twoFolders() {
  return useExplorer({
    load: () => Promise.resolve([
      { id: 'keep', parentId: null, kind: 'folder' as const, name: 'Keep', position: 0 },
      { id: 'bin', parentId: null, kind: 'folder' as const, name: 'Bin', position: 1 },
      { id: 'one', parentId: null, kind: 'item' as const, name: 'One', position: 2 },
      { id: 'two', parentId: null, kind: 'item' as const, name: 'Two', position: 3 },
    ]),
    move: () => Promise.resolve(),
  })
}

/** A source with a folder action, over two folders: one ordinary, one disabled. */
function editable() {
  return useExplorer({
    load: () => Promise.resolve([
      { id: 'open', parentId: null, kind: 'folder' as const, name: 'Open', position: 0 },
      {
        id: 'locked',
        parentId: null,
        kind: 'folder' as const,
        name: 'Locked',
        position: 1,
        disabled: true,
      },
    ]),
    deleteFolder: () => Promise.resolve(),
  })
}

/** A drag carrying files from outside the page. */
function fileDrag() {
  return { dataTransfer: { types: ['Files'], files: [new File(['x'], 'a.png')] } }
}

// Vuetify's overlay reads `visualViewport` when a menu opens; happy-dom has none.
if (!('visualViewport' in globalThis)) {
  Object.defineProperty(globalThis, 'visualViewport', {
    configurable: true,
    value: {
      width: 1024,
      height: 768,
      offsetLeft: 0,
      offsetTop: 0,
      scale: 1,
      addEventListener: () => {},
      removeEventListener: () => {},
    },
  })
}

beforeEach(() => {
  disposeExplorer()
  configureExplorer({
    tile: {
      variant: 'card',
      aspect: 1,
      fit: 'cover',
      label: 'under',
      hover: 'tint',
      badge: 'count',
      menu: 'hover',
      check: false,
    },
    behaviour: { activate: 'single', select: 'none', springOpen: 0, keyboard: true },
  })
})

afterEach(() => {
  for (const wrapper of mounted.splice(0)) wrapper.unmount()
  document.body.innerHTML = ''
})

describe('what a node can say about its own tile', () => {
  it('draws a cover, and gives a folder with one the shape a picture needs', async () => {
    const wrapper = mountExplorer(movable())
    await flushPromises()

    const folder = wrapper.findAll('.s99ab-tile')[0]!
    expect(folder.find('.s99ab-tile__image').exists()).toBe(true)
    // A cover moves the label onto its own strip.
    expect(folder.find('.s99ab-tile__label').exists()).toBe(true)
    expect(folder.find('.s99ab-tile__head').exists()).toBe(false)
  })

  // A cover that fails to load shows the glyph and keeps the tile's shape.
  it('falls back to the glyph when a cover will not load', async () => {
    const wrapper = mountExplorer(movable())
    await flushPromises()
    const folder = wrapper.findAll('.s99ab-tile')[0]!

    await folder.find('.s99ab-tile__image').trigger('error')

    expect(folder.find('.s99ab-tile__image').exists()).toBe(false)
    expect(folder.find('.s99ab-tile__icon').exists()).toBe(true)
    expect(folder.find('.s99ab-tile__label').exists()).toBe(true)
  })

  it('marks a pinned node, and leaves the corner alone otherwise', async () => {
    const wrapper = mountExplorer(useExplorer({
      load: () => Promise.resolve([
        { id: 'kept', parentId: null, kind: 'folder' as const, name: 'Kept', pinned: true },
        { id: 'other', parentId: null, kind: 'folder' as const, name: 'Other' },
      ]),
    }))
    await flushPromises()
    const tiles = wrapper.findAll('.s99ab-tile')

    expect(tiles[0]!.find('.s99ab-tile__pin').exists()).toBe(true)
    expect(tiles[0]!.classes()).toContain('s99ab-tile--pinned')
    expect(tiles[1]!.find('.s99ab-tile__pin').exists()).toBe(false)
  })

  it('draws the badge the node asked for', async () => {
    const wrapper = mountExplorer(movable())
    await flushPromises()

    expect(wrapper.findAll('.s99ab-tile')[1]!.find('.s99ab-tile__count').text()).toBe('draft')
  })

  it('counts children for a folder that said nothing', async () => {
    const explorer = useExplorer({ load: () => Promise.resolve(seed()) })
    const wrapper = mountExplorer(explorer)
    await flushPromises()

    expect(wrapper.findAll('.s99ab-tile')[0]!.find('.s99ab-tile__count').text()).toBe('1')
  })

  it('refuses everything on a disabled node, including the drag', async () => {
    const explorer = movable()
    const wrapper = mountExplorer(explorer)
    await flushPromises()
    const note = wrapper.findAll('.s99ab-tile')[1]!

    expect(note.attributes('draggable')).toBe('false')
    expect(note.attributes('aria-disabled')).toBe('true')

    await note.trigger('click')
    expect(wrapper.emitted('open')).toBeUndefined()
  })
})

describe('a node the source keeps in place', () => {
  it('is not draggable, while its neighbours are', async () => {
    const explorer = useExplorer({
      load: () => Promise.resolve(seed()),
      move: () => Promise.resolve(),
      canMove: node => node.id !== 'photo',
    })
    const wrapper = mountExplorer(explorer)
    await flushPromises()
    const [docs, , photo] = wrapper.findAll('.s99ab-tile')

    expect(docs!.attributes('draggable')).toBe('true')
    expect(photo!.attributes('draggable')).toBe('false')
  })
})

// The icon variant: a glyph or preview with the name under it, no ground.
describe('the icon variant', () => {
  it('gives every tile the same shape: something, then its name under it', async () => {
    configureExplorer({ tile: { variant: 'icon' } })
    const wrapper = mountExplorer(movable())
    await flushPromises()
    const tiles = wrapper.findAll('.s99ab-tile')

    // A folder with a cover and a leaf without one are drawn the same way.
    for (const tile of [tiles[0]!, tiles[1]!]) {
      expect(tile.find('.s99ab-tile__thumb').exists()).toBe(true)
      expect(tile.find('.s99ab-tile__label').exists()).toBe(true)
      expect(tile.find('.s99ab-tile__head').exists()).toBe(false)
    }
  })

  // Both belong to the card's face, which the icon variant does not have.
  it('drops the count chip, and the name never sits on the picture', async () => {
    configureExplorer({ tile: { variant: 'icon', label: 'over' } })
    const wrapper = mountExplorer(movable())
    await flushPromises()
    const folder = wrapper.findAll('.s99ab-tile')[0]!

    expect(folder.find('.s99ab-tile__count').exists()).toBe(false)
    expect(folder.classes()).not.toContain('s99ab-tile--over')
  })

  it('is told apart by the region, so one stylesheet dresses both', async () => {
    configureExplorer({ tile: { variant: 'icon' } })
    const wrapper = mountExplorer(movable())
    await flushPromises()

    expect(wrapper.find('.s99ab-explorer').attributes('data-tile-variant')).toBe('icon')
  })
})

describe('the ... trigger', () => {
  // Not drawn on a disabled node, where every entry would be refused.
  it('is drawn where the menu has something in it, and not on a disabled node', async () => {
    const wrapper = mountExplorer(editable())
    await flushPromises()
    const tiles = wrapper.findAll('.s99ab-tile')

    expect(tiles[0]!.find('.s99ab-tile__more').exists()).toBe(true)
    expect(tiles[1]!.find('.s99ab-tile__more').exists()).toBe(false)
  })

  // Pressing it opens a menu without starting a tile drag.
  it('is not part of the tile drag surface', async () => {
    const wrapper = mountExplorer(editable())
    await flushPromises()

    expect(wrapper.find('.s99ab-tile__more').attributes('draggable')).toBe('false')
  })

  it('can be left off, leaving the menu to a right-click', async () => {
    configureExplorer({ tile: { menu: 'none' } })
    const wrapper = mountExplorer(editable())
    await flushPromises()
    const folder = wrapper.findAll('.s99ab-tile')[0]!

    expect(folder.find('.s99ab-tile__more').exists()).toBe(false)

    await folder.trigger('contextmenu')
    expect(wrapper.emitted('menu')?.[0]?.[0]).toEqual(expect.objectContaining({ id: 'open' }))
  })
})

// A press on a cover starts the tile drag instead of the browser's image drag.
describe('what a tile can be grabbed by', () => {
  it('takes the preview out of the browser own drag', async () => {
    const wrapper = mountExplorer(movable())
    await flushPromises()

    expect(wrapper.find('.s99ab-tile__image').attributes('draggable')).toBe('false')
  })
})

describe('what a click means', () => {
  it('opens on the first click by default', async () => {
    const explorer = movable()
    const wrapper = mountExplorer(explorer)
    await flushPromises()

    await wrapper.findAll('.s99ab-tile')[0]!.trigger('click')
    expect(explorer.currentId.value).toBe('docs')
  })

  it('leaves the first click alone where the app asked for two', async () => {
    configureExplorer({ behaviour: { activate: 'double' } })
    const explorer = movable()
    const wrapper = mountExplorer(explorer)
    await flushPromises()
    const folder = wrapper.findAll('.s99ab-tile')[0]!

    await folder.trigger('click')
    expect(explorer.currentId.value).toBeNull()

    await folder.trigger('dblclick')
    expect(explorer.currentId.value).toBe('docs')
  })
})

describe('picking tiles', () => {
  it('reports what is picked, and keeps the corner it had', async () => {
    configureExplorer({ behaviour: { select: 'multi' } })
    const wrapper = mountExplorer(movable(), { selected: [] })
    await flushPromises()
    const folder = wrapper.findAll('.s99ab-tile')[0]!

    await folder.trigger('click', { ctrlKey: true })

    expect(wrapper.emitted('update:selected')?.at(-1)).toEqual([['docs']])
    expect(wrapper.emitted('select')?.at(-1)?.[0]).toEqual([
      expect.objectContaining({ id: 'docs' }),
    ])
    // No tick: a picked tile is shown by its face.
    expect(folder.find('.s99ab-tile__check').exists()).toBe(false)
    expect(folder.find('.s99ab-tile__count').exists()).toBe(true)
  })

  it('gives the corner to a tick only where the app asked for one', async () => {
    configureExplorer({ behaviour: { select: 'multi' }, tile: { check: true } })
    const wrapper = mountExplorer(movable(), { selected: [] })
    await flushPromises()
    const folder = wrapper.findAll('.s99ab-tile')[0]!

    expect(folder.find('.s99ab-tile__check').exists()).toBe(true)
    expect(folder.find('.s99ab-tile__count').exists()).toBe(false)
  })

  // The first click of a double-click picks without navigating.
  it('picks without opening where opening takes two clicks', async () => {
    configureExplorer({ behaviour: { select: 'multi', activate: 'double' } })
    const explorer = movable()
    const wrapper = mountExplorer(explorer, { selected: [] })
    await flushPromises()

    await wrapper.findAll('.s99ab-tile')[0]!.trigger('click')

    expect(explorer.currentId.value).toBeNull()
    expect(wrapper.emitted('update:selected')?.at(-1)).toEqual([['docs']])
  })

  // The menu acts on the selection: a tile outside it becomes the selection,
  // a tile inside it keeps the rest.
  it('makes the tile under a right-click the selection, unless it is in one', async () => {
    configureExplorer({ behaviour: { select: 'multi' } })
    const wrapper = mountExplorer(movable(), { selected: [] })
    await flushPromises()
    const tiles = wrapper.findAll('.s99ab-tile')

    await tiles[0]!.trigger('contextmenu')
    expect(wrapper.emitted('update:selected')?.at(-1)).toEqual([['docs']])

    await tiles[2]!.trigger('click', { ctrlKey: true })
    await tiles[0]!.trigger('contextmenu')

    expect(wrapper.emitted('update:selected')?.at(-1)).toEqual([['docs', 'photo']])
  })

  it('drops the selection when the space between tiles is pressed', async () => {
    configureExplorer({ behaviour: { select: 'multi' } })
    const wrapper = mountExplorer(movable(), { selected: ['docs'] })
    await flushPromises()

    await wrapper.find('.s99ab-explorer__grid').trigger('mousedown')

    expect(wrapper.emitted('update:selected')?.at(-1)).toEqual([[]])
  })

  it('keeps it when that press is a ctrl-press, which starts a second run', async () => {
    configureExplorer({ behaviour: { select: 'multi' } })
    const wrapper = mountExplorer(movable(), { selected: ['docs'] })
    await flushPromises()

    await wrapper.find('.s99ab-explorer__grid').trigger('mousedown', { ctrlKey: true })

    expect(wrapper.emitted('update:selected')).toBeUndefined()
  })

  // Dragging a picked tile moves the selection; an unpicked one becomes the selection first.
  it('carries the whole selection into a drop', async () => {
    configureExplorer({ behaviour: { select: 'multi' } })
    const explorer = twoFolders()
    const moved: string[] = []
    explorer.events.on('move', move => moved.push(move.id))
    const wrapper = mountExplorer(explorer, { selected: ['keep', 'one'] })
    await flushPromises()

    // The grid is keep, bin, one, two: the third tile is the picked leaf.
    await wrapper.findAll('.s99ab-tile')[2]!.trigger('dragstart')
    explorer.drag.dropInto('bin')

    expect(moved).toEqual(['one', 'keep'])
  })

  // The selection keeps its own copy, since a v-model prop updates a render
  // later. Here the parent never catches up.
  it('reads back what it just wrote while the model is still behind', async () => {
    configureExplorer({ behaviour: { select: 'multi' } })
    const explorer = twoFolders()
    const moved: string[] = []
    explorer.events.on('move', move => moved.push(move.id))
    const wrapper = mountExplorer(explorer, {
      'selected': ['keep'],
      'onUpdate:selected': () => {},
    })
    await flushPromises()

    await wrapper.findAll('.s99ab-tile')[3]!.trigger('dragstart')
    explorer.drag.dropInto('bin')

    expect(moved).toEqual(['two'])
  })

  it('leaves the selection alone when an unpicked tile is dragged', async () => {
    configureExplorer({ behaviour: { select: 'multi' } })
    const explorer = twoFolders()
    const moved: string[] = []
    explorer.events.on('move', move => moved.push(move.id))
    const wrapper = mountExplorer(explorer, { selected: ['keep'] })
    await flushPromises()

    await wrapper.findAll('.s99ab-tile')[3]!.trigger('dragstart')
    explorer.drag.dropInto('bin')

    expect(moved).toEqual(['two'])
    expect(wrapper.emitted('update:selected')?.at(-1)).toEqual([['two']])
  })

  it('says which tile is picked where a screen reader can hear it', async () => {
    configureExplorer({ behaviour: { select: 'single' } })
    const wrapper = mountExplorer(movable(), { selected: ['docs'] })
    await flushPromises()

    expect(wrapper.findAll('.s99ab-tile')[0]!.attributes('aria-selected')).toBe('true')
    expect(wrapper.findAll('.s99ab-tile')[1]!.attributes('aria-selected')).toBe('false')
  })

  it('leaves the corner to the badge when nothing is being picked', async () => {
    const wrapper = mountExplorer(movable())
    await flushPromises()

    expect(wrapper.find('.s99ab-tile__check').exists()).toBe(false)
  })
})

describe('files from outside the page', () => {
  it('reports the folder they landed on rather than moving anything', async () => {
    const explorer = movable()
    const wrapper = mountExplorer(explorer, { acceptFiles: true })
    await flushPromises()

    await wrapper.findAll('.s99ab-tile')[0]!.trigger('drop', fileDrag())

    expect(wrapper.emitted('files')?.[0]?.[0]).toBe('docs')
    expect((wrapper.emitted('files')?.[0]?.[1] as File[])[0]?.name).toBe('a.png')
    expect(explorer.currentId.value).toBeNull()
  })

  it('reports the open folder when they land on the space between tiles', async () => {
    const explorer = movable()
    const wrapper = mountExplorer(explorer, { acceptFiles: true })
    await flushPromises()
    explorer.navigate('docs')
    await nextTick()

    await wrapper.find('.s99ab-explorer__grid').trigger('drop', fileDrag())

    expect(wrapper.emitted('files')?.[0]?.[0]).toBe('docs')
  })

  // File drops are off by default.
  it('is inert unless the screen asked for it', async () => {
    const wrapper = mountExplorer(movable())
    await flushPromises()

    await wrapper.findAll('.s99ab-tile')[0]!.trigger('drop', fileDrag())

    expect(wrapper.emitted('files')).toBeUndefined()
  })
})

describe('spring-loaded folders', () => {
  it('opens a folder a drag has dwelt on, so filing deep is one drag', async () => {
    vi.useFakeTimers()
    configureExplorer({ behaviour: { springOpen: 400 } })
    const explorer = movable()
    const wrapper = mountExplorer(explorer)
    await flushPromises()

    explorer.drag.begin(explorer.children.value[2]!)
    await wrapper.findAll('.s99ab-tile')[0]!.trigger('dragover')
    vi.advanceTimersByTime(400)

    expect(explorer.currentId.value).toBe('docs')
    vi.useRealTimers()
  })

  it('opens nothing where the pointer left before the dwell was up', async () => {
    vi.useFakeTimers()
    configureExplorer({ behaviour: { springOpen: 400 } })
    const explorer = movable()
    const wrapper = mountExplorer(explorer)
    await flushPromises()
    const folder = wrapper.findAll('.s99ab-tile')[0]!

    explorer.drag.begin(explorer.children.value[2]!)
    await folder.trigger('dragover')
    vi.advanceTimersByTime(200)
    await folder.trigger('dragleave')
    vi.advanceTimersByTime(400)

    expect(explorer.currentId.value).toBeNull()
    vi.useRealTimers()
  })

  it('is off unless the app asked for it', async () => {
    vi.useFakeTimers()
    const explorer = movable()
    const wrapper = mountExplorer(explorer)
    await flushPromises()

    explorer.drag.begin(explorer.children.value[2]!)
    await wrapper.findAll('.s99ab-tile')[0]!.trigger('dragover')
    vi.advanceTimersByTime(5000)

    expect(explorer.currentId.value).toBeNull()
    vi.useRealTimers()
  })
})

describe('the arrow keys', () => {
  it('moves focus along the grid, and to its ends', async () => {
    const wrapper = mountExplorer(movable())
    await flushPromises()
    const tiles = wrapper.findAll('.s99ab-tile')
    const grid = wrapper.find('.s99ab-explorer__grid')

    ;(tiles[0]!.element as HTMLElement).focus()
    await grid.trigger('keydown', { key: 'ArrowRight' })
    expect(document.activeElement).toBe(tiles[1]!.element)

    await grid.trigger('keydown', { key: 'End' })
    expect(document.activeElement).toBe(tiles[2]!.element)

    await grid.trigger('keydown', { key: 'Home' })
    expect(document.activeElement).toBe(tiles[0]!.element)
  })

  it('stops at the ends rather than wrapping round', async () => {
    const wrapper = mountExplorer(movable())
    await flushPromises()
    const tiles = wrapper.findAll('.s99ab-tile')
    const grid = wrapper.find('.s99ab-explorer__grid')

    ;(tiles[0]!.element as HTMLElement).focus()
    await grid.trigger('keydown', { key: 'ArrowLeft' })

    expect(document.activeElement).toBe(tiles[0]!.element)
  })

  it('leaves the keys alone where the app turned them off', async () => {
    configureExplorer({ behaviour: { keyboard: false } })
    const wrapper = mountExplorer(movable())
    await flushPromises()
    const tiles = wrapper.findAll('.s99ab-tile')

    ;(tiles[0]!.element as HTMLElement).focus()
    await wrapper.find('.s99ab-explorer__grid').trigger('keydown', { key: 'ArrowRight' })

    expect(document.activeElement).toBe(tiles[0]!.element)
  })

  it('picks the whole folder on ctrl+a while selecting', async () => {
    configureExplorer({ behaviour: { select: 'multi' } })
    const wrapper = mountExplorer(movable(), { selected: [] })
    await flushPromises()

    await wrapper.find('.s99ab-explorer__grid').trigger('keydown', { key: 'a', ctrlKey: true })

    // The disabled one is excluded.
    expect(wrapper.emitted('update:selected')?.at(-1)).toEqual([['docs', 'photo']])
  })
})
