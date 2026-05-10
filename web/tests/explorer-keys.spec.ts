// web/tests/explorer-keys.spec.ts

import { createVuetify } from 'vuetify'
import * as components from 'vuetify/components'
import * as directives from 'vuetify/directives'
import { flushPromises, mount } from '@vue/test-utils'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import Explorer from '../src/components/explorer/Explorer.vue'
import { disposeExplorer, useExplorer } from '../src/composables/explorer/useExplorer'
import { configureExplorer } from '../src/composables/explorer/useExplorerConfig'
import type { ExplorerNode } from '../src/composables/explorer/useExplorerTree'

const vuetify = createVuetify({ components, directives })

// One folder and three leaves at the root, so a run has something to cross.
function seed(): ExplorerNode[] {
  return [
    { id: 'docs', parentId: null, kind: 'folder', name: 'Docs', position: 0 },
    { id: 'one', parentId: null, kind: 'item', name: 'One', position: 0 },
    { id: 'two', parentId: null, kind: 'item', name: 'Two', position: 1 },
    { id: 'three', parentId: null, kind: 'item', name: 'Three', position: 2 },
  ]
}

const mounted: Array<{ unmount: () => void }> = []

function mountExplorer(props: Record<string, unknown> = {}) {
  const explorer = useExplorer({ load: () => Promise.resolve(seed()) })
  const wrapper = mount(Explorer, {
    attachTo: document.body,
    props: { explorer, selected: [], ...props },
    global: { plugins: [vuetify] },
  })
  mounted.push(wrapper)
  return wrapper
}

/** The model's last written value. */
const picked = (wrapper: ReturnType<typeof mountExplorer>) =>
  wrapper.emitted('update:selected')?.at(-1)?.[0]

beforeEach(() => {
  disposeExplorer()
  configureExplorer({ behaviour: { select: 'multi', activate: 'double', keyboard: true } })
})

afterEach(() => {
  for (const wrapper of mounted.splice(0)) wrapper.unmount()
  document.body.innerHTML = ''
})

// Arrow keys move the selection, not only the focus, so a run can be picked by keyboard.
describe('the arrow keys', () => {
  it('carries the selection to whatever it lands on', async () => {
    const wrapper = mountExplorer()
    await flushPromises()
    const tiles = wrapper.findAll('.s99ab-tile')
    const grid = wrapper.find('.s99ab-explorer__grid')

    ;(tiles[0]!.element as HTMLElement).focus()
    await grid.trigger('keydown', { key: 'ArrowRight' })

    expect(document.activeElement).toBe(tiles[1]!.element)
    expect(picked(wrapper)).toEqual(['one'])
  })

  it('extends the run when shift is held', async () => {
    const wrapper = mountExplorer()
    await flushPromises()
    const tiles = wrapper.findAll('.s99ab-tile')
    const grid = wrapper.find('.s99ab-explorer__grid')

    ;(tiles[0]!.element as HTMLElement).focus()
    await grid.trigger('keydown', { key: 'ArrowRight' })
    await grid.trigger('keydown', { key: 'ArrowRight', shiftKey: true })

    expect(picked(wrapper)).toEqual(['one', 'two'])
  })

  // Ctrl moves focus only, to reach a distant tile without selecting the ones between.
  it('moves focus and nothing else when ctrl is held', async () => {
    const wrapper = mountExplorer({ selected: ['docs'] })
    await flushPromises()
    const tiles = wrapper.findAll('.s99ab-tile')
    const grid = wrapper.find('.s99ab-explorer__grid')

    ;(tiles[0]!.element as HTMLElement).focus()
    await grid.trigger('keydown', { key: 'ArrowRight', ctrlKey: true })

    expect(document.activeElement).toBe(tiles[1]!.element)
    expect(wrapper.emitted('update:selected')).toBeUndefined()
  })
})

describe('space and escape', () => {
  it('picks what is focused, and toggles it with ctrl', async () => {
    const wrapper = mountExplorer()
    await flushPromises()
    const tiles = wrapper.findAll('.s99ab-tile')
    const grid = wrapper.find('.s99ab-explorer__grid')

    ;(tiles[1]!.element as HTMLElement).focus()
    await grid.trigger('keydown', { key: ' ' })
    expect(picked(wrapper)).toEqual(['one'])

    ;(tiles[2]!.element as HTMLElement).focus()
    await grid.trigger('keydown', { key: ' ', ctrlKey: true })
    expect(picked(wrapper)).toEqual(['one', 'two'])

    await grid.trigger('keydown', { key: ' ', ctrlKey: true })
    expect(picked(wrapper)).toEqual(['one'])
  })

  it('drops the selection on escape', async () => {
    const wrapper = mountExplorer({ selected: ['one', 'two'] })
    await flushPromises()

    await wrapper.find('.s99ab-explorer__grid').trigger('keydown', { key: 'Escape' })

    expect(picked(wrapper)).toEqual([])
  })

  // Enter opens the focused tile, space picks it.
  it('leaves Enter to the tile', async () => {
    const wrapper = mountExplorer()
    await flushPromises()
    const tiles = wrapper.findAll('.s99ab-tile')

    await tiles[1]!.trigger('keydown', { key: 'Enter' })

    expect(wrapper.emitted('open')?.[0]?.[0]).toEqual(expect.objectContaining({ id: 'one' }))
  })
})

describe('with selection off', () => {
  it('moves focus and picks nothing', async () => {
    configureExplorer({ behaviour: { select: 'none' } })
    const wrapper = mountExplorer()
    await flushPromises()
    const tiles = wrapper.findAll('.s99ab-tile')

    ;(tiles[0]!.element as HTMLElement).focus()
    await wrapper.find('.s99ab-explorer__grid').trigger('keydown', { key: 'ArrowRight' })

    expect(document.activeElement).toBe(tiles[1]!.element)
    expect(wrapper.emitted('update:selected')).toBeUndefined()
  })

  it('leaves space as a second Enter, so the tile still opens', async () => {
    configureExplorer({ behaviour: { select: 'none' } })
    const wrapper = mountExplorer()
    await flushPromises()

    await wrapper.findAll('.s99ab-tile')[1]!.trigger('keydown', { key: ' ' })

    expect(wrapper.emitted('open')?.[0]?.[0]).toEqual(expect.objectContaining({ id: 'one' }))
  })
})
