// web/tests/explorer-select.spec.ts

import { ref } from 'vue'
import { beforeEach, describe, expect, it } from 'vitest'
import { disposeExplorer, useExplorer } from '../src/composables/explorer/useExplorer'
import { configureExplorer } from '../src/composables/explorer/useExplorerConfig'
import { useExplorerSelection } from '../src/composables/explorer/useExplorerSelection'
import type { ExplorerNode } from '../src/composables/explorer/useExplorerTree'

// docs, note, sheet, photo: one folder and three leaves at the root, so a
// shift-range has something to run over. `sheet` is disabled.
function seed(): ExplorerNode[] {
  return [
    { id: 'docs', parentId: null, kind: 'folder', name: 'docs', position: 0 },
    { id: 'note', parentId: null, kind: 'item', name: 'note', position: 0 },
    { id: 'sheet', parentId: null, kind: 'item', name: 'sheet', position: 1, disabled: true },
    { id: 'photo', parentId: null, kind: 'item', name: 'photo', position: 2 },
  ]
}

async function selecting(mode: 'none' | 'single' | 'multi') {
  configureExplorer({ behaviour: { select: mode } })
  const explorer = useExplorer({ load: () => Promise.resolve(seed()) })
  await explorer.refresh()

  const model = ref<string[]>([])
  return { explorer, model, selection: useExplorerSelection(explorer, model) }
}

const at = (nodes: readonly ExplorerNode[], id: string) => nodes.find(n => n.id === id)!

beforeEach(() => {
  disposeExplorer()
  configureExplorer({ behaviour: { select: 'none', activate: 'single' } })
})

describe('with selection off', () => {
  it('picks nothing, so a screen that never asked for one cannot get one', async () => {
    const { explorer, selection, model } = await selecting('none')

    selection.pick(at(explorer.children.value, 'note'))
    expect(model.value).toEqual([])
    expect(selection.active.value).toBe(false)
  })
})

describe('single', () => {
  it('replaces, so there is only ever one', async () => {
    const { explorer, selection, model } = await selecting('single')

    selection.pick(at(explorer.children.value, 'note'))
    selection.pick(at(explorer.children.value, 'photo'))

    expect(model.value).toEqual(['photo'])
  })

  // Ctrl-click on the picked tile clears it; a plain click keeps it.
  it('drops the one it has on a ctrl-click, and not on a plain one', async () => {
    const { explorer, selection, model } = await selecting('single')
    const note = at(explorer.children.value, 'note')

    selection.pick(note)
    selection.pick(note)
    expect(model.value).toEqual(['note'])

    selection.pick(note, { ctrl: true })
    expect(model.value).toEqual([])
  })
})

describe('multi', () => {
  it('replaces on a plain click and adds on ctrl', async () => {
    const { explorer, selection, model } = await selecting('multi')
    const nodes = explorer.children.value

    selection.pick(at(nodes, 'note'))
    selection.pick(at(nodes, 'photo'), { ctrl: true })
    expect(model.value).toEqual(['note', 'photo'])

    selection.pick(at(nodes, 'note'), { ctrl: true })
    expect(model.value).toEqual(['photo'])

    selection.pick(at(nodes, 'docs'))
    expect(model.value).toEqual(['docs'])
  })

  // The run follows on-screen order (folders first), not id order.
  it('runs from the anchor to the tile shift was held on', async () => {
    const { explorer, selection, model } = await selecting('multi')
    const nodes = explorer.children.value

    selection.pick(at(nodes, 'docs'))
    selection.pick(at(nodes, 'photo'), { shift: true })

    // sheet is disabled and sits inside the run.
    expect(model.value).toEqual(['docs', 'note', 'photo'])
  })

  it('runs backwards too', async () => {
    const { explorer, selection, model } = await selecting('multi')
    const nodes = explorer.children.value

    selection.pick(at(nodes, 'photo'))
    selection.pick(at(nodes, 'docs'), { shift: true })

    expect(model.value).toEqual(['docs', 'note', 'photo'])
  })

  // ctrl+shift adds a run; plain shift replaces.
  it('adds a run to what is picked when ctrl and shift are both held', async () => {
    const { explorer, selection, model } = await selecting('multi')
    const nodes = explorer.children.value

    selection.pick(at(nodes, 'photo'))
    selection.pick(at(nodes, 'docs'), { ctrl: true })
    selection.pick(at(nodes, 'note'), { ctrl: true, shift: true })

    expect(model.value.sort()).toEqual(['docs', 'note', 'photo'])
  })

  // The anchor stays put, so shift-clicks grow and shrink the run from the same end.
  it('measures every shift-click from the same anchor', async () => {
    const { explorer, selection, model } = await selecting('multi')
    const nodes = explorer.children.value

    selection.pick(at(nodes, 'docs'))
    selection.pick(at(nodes, 'photo'), { shift: true })
    selection.pick(at(nodes, 'note'), { shift: true })

    expect(model.value).toEqual(['docs', 'note'])
  })

  // A selection belongs to the folder it was made in.
  it('empties when the open folder changes', async () => {
    const { explorer, selection, model } = await selecting('multi')

    selection.pick(at(explorer.children.value, 'note'))
    explorer.navigate('docs')

    expect(model.value).toEqual([])
  })

  it('makes an outside node the selection, and leaves an inside one alone', async () => {
    const { explorer, selection, model } = await selecting('multi')
    const nodes = explorer.children.value

    selection.pick(at(nodes, 'docs'))
    selection.pick(at(nodes, 'note'), { ctrl: true })

    selection.ensure(at(nodes, 'docs'))
    expect(model.value).toEqual(['docs', 'note'])

    selection.ensure(at(nodes, 'photo'))
    expect(model.value).toEqual(['photo'])
  })

  // In grid order, so a group drag lands in the same order.
  it('lists what is picked in the order it is drawn', async () => {
    const { explorer, selection } = await selecting('multi')
    const nodes = explorer.children.value

    selection.pick(at(nodes, 'photo'))
    selection.pick(at(nodes, 'docs'), { ctrl: true })

    expect(selection.ordered().map(n => n.id)).toEqual(['docs', 'photo'])
  })

  it('picks everything on the screen, and nothing that refuses', async () => {
    const { selection, model } = await selecting('multi')

    selection.all()
    expect(model.value).toEqual(['docs', 'note', 'photo'])

    selection.clear()
    expect(model.value).toEqual([])
  })

  it('never picks a disabled node', async () => {
    const { explorer, selection, model } = await selecting('multi')

    selection.pick(at(explorer.children.value, 'sheet'))
    expect(model.value).toEqual([])
  })

  it('resolves ids to the nodes a screen would act on', async () => {
    const { explorer, selection } = await selecting('multi')

    selection.pick(at(explorer.children.value, 'note'))
    expect(selection.nodes.value.map(n => n.name)).toEqual(['note'])
  })

  // Picking the same set again does not rewrite the model, so @select watchers do not rerun.
  it('writes nothing when the same set is picked twice', async () => {
    const { explorer, selection, model } = await selecting('multi')
    const note = at(explorer.children.value, 'note')

    selection.pick(note)
    const first = model.value
    selection.pick(note)

    expect(model.value).toBe(first)
  })
})
