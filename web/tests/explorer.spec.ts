// web/tests/explorer.spec.ts

import { nextTick } from 'vue'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { flushPromises } from '@vue/test-utils'
import {
  disposeExplorer,
  type ExplorerMove,
  type ExplorerSource,
  useExplorer,
} from '../src/composables/explorer/useExplorer'
import type { ExplorerNode } from '../src/composables/explorer/internal/tree'

// docs
// +-- deep          (folder)
// |   +-- deeper    (folder)
// +-- note          (item)
// +-- sheet         (item)
// photo             (item)
function seed(): ExplorerNode[] {
  return [
    { id: 'docs', parentId: null, kind: 'folder', name: 'docs', position: 0 },
    { id: 'deep', parentId: 'docs', kind: 'folder', name: 'deep', position: 0 },
    { id: 'deeper', parentId: 'deep', kind: 'folder', name: 'deeper', position: 0 },
    { id: 'note', parentId: 'docs', kind: 'item', name: 'note', position: 0 },
    { id: 'sheet', parentId: 'docs', kind: 'item', name: 'sheet', position: 1 },
    { id: 'photo', parentId: null, kind: 'item', name: 'photo', position: 0 },
  ]
}

function sourceOf(nodes: ExplorerNode[] = seed()): ExplorerSource & { moves: ExplorerMove[] } {
  const moves: ExplorerMove[] = []
  return {
    moves,
    load: () => Promise.resolve([...nodes]),
    move: (m) => {
      moves.push(m)
      return Promise.resolve()
    },
    createFolder: () => Promise.resolve(),
    renameFolder: () => Promise.resolve(),
    deleteFolder: () => Promise.resolve(),
  }
}

beforeEach(() => {
  disposeExplorer()
})

describe('loading and navigation', () => {
  it('shows the root the way a file manager does, folders before items', async () => {
    const explorer = useExplorer(sourceOf())
    await explorer.refresh()

    expect(explorer.children.value.map(n => n.id)).toEqual(['docs', 'photo'])
    expect(explorer.path.value).toEqual([])
  })

  it('navigates into a folder and back out', async () => {
    const explorer = useExplorer(sourceOf())
    await explorer.refresh()

    explorer.navigate('deep')
    expect(explorer.children.value.map(n => n.id)).toEqual(['deeper'])
    expect(explorer.path.value.map(n => n.id)).toEqual(['docs', 'deep'])

    explorer.up()
    expect(explorer.currentId.value).toBe('docs')
  })

  it('counts a folder\'s children without walking the tree per tile', async () => {
    const explorer = useExplorer(sourceOf())
    await explorer.refresh()

    expect(explorer.countOf('docs')).toBe(3)
    expect(explorer.countOf('deeper')).toBe(0)
  })

  it('lands on the nearest surviving ancestor when the open folder is gone', async () => {
    const nodes = seed()
    const explorer = useExplorer(sourceOf(nodes))
    await explorer.refresh()
    explorer.navigate('deep')

    nodes.splice(nodes.findIndex(n => n.id === 'deep'), 1)
    await explorer.refresh()

    expect(explorer.currentId.value).toBe('docs')
  })

  it('falls back to the root when the whole branch is gone', async () => {
    const nodes = seed()
    const explorer = useExplorer(sourceOf(nodes))
    await explorer.refresh()
    explorer.navigate('deep')

    nodes.splice(0, nodes.length, { id: 'photo', parentId: null, kind: 'item', name: 'photo' })
    await explorer.refresh()

    expect(explorer.currentId.value).toBeNull()
    expect(explorer.children.value.map(n => n.id)).toEqual(['photo'])
  })

  it('reports a load failure instead of rendering an empty tree', async () => {
    const explorer = useExplorer({ load: () => Promise.reject(new Error('offline')) })
    await explorer.refresh()

    expect(explorer.error.value).toBeInstanceOf(Error)
    expect(explorer.initialized.value).toBe(true)
  })
})

describe('pinning', () => {
  it('sorts what is pinned to the front, ahead of the folders', async () => {
    const explorer = useExplorer({
      load: () => Promise.resolve([
        { id: 'docs', parentId: null, kind: 'folder', name: 'docs', position: 0 },
        { id: 'note', parentId: null, kind: 'item', name: 'note', position: 1, pinned: true },
        { id: 'more', parentId: null, kind: 'folder', name: 'more', position: 2 },
      ] satisfies ExplorerNode[]),
    })
    await explorer.refresh()

    expect(explorer.children.value.map(n => n.id)).toEqual(['note', 'docs', 'more'])
  })

  it('records it through the source and says so', async () => {
    const pinned: Array<[string, boolean]> = []
    const explorer = useExplorer({
      load: () => Promise.resolve(seed()),
      pin: (id, on) => {
        pinned.push([id, on])
        return Promise.resolve()
      },
    })
    await explorer.refresh()
    const heard: Array<[string, boolean]> = []
    explorer.events.on('pin', (id, on) => heard.push([id, on]))

    await explorer.setPinned('docs', true)

    expect(pinned).toEqual([['docs', true]])
    expect(heard).toEqual([['docs', true]])
  })

  it('says which method is missing when the source cannot pin', async () => {
    const explorer = useExplorer({ load: () => Promise.resolve(seed()) })
    await explorer.refresh()

    expect(() => explorer.setPinned('docs', true)).toThrow(/pin/)
  })
})

describe('capabilities', () => {
  it('derives what the UI may offer from what the source implements', () => {
    const full = useExplorer({ ...sourceOf(), pin: () => Promise.resolve() })
    expect(full.can.value).toEqual({
      move: true,
      create: true,
      rename: true,
      remove: true,
      pin: true,
    })

    const readOnly = useExplorer({ load: () => Promise.resolve(seed()) })
    expect(readOnly.can.value).toEqual({
      move: false,
      create: false,
      rename: false,
      remove: false,
      pin: false,
    })
  })

  it('stops offering new folders once the cap is reached', async () => {
    const explorer = useExplorer(sourceOf(), { maxDepth: 2 })
    await explorer.refresh()

    expect(explorer.canCreateIn(null)).toBe(true)
    expect(explorer.canCreateIn('docs')).toBe(true)
    expect(explorer.canCreateIn('deep')).toBe(false)
  })
})

describe('moving a node into a folder', () => {
  it('applies the move before the request answers, so the drop feels instant', async () => {
    const source = sourceOf()
    let settle = () => {}
    source.move = (m) => {
      source.moves.push(m)
      return new Promise<void>((resolve) => {
        settle = resolve
      })
    }
    const explorer = useExplorer(source)
    await explorer.refresh()

    explorer.drag.begin(explorer.children.value[1]!) // photo
    explorer.drag.dropInto('docs')

    expect(explorer.children.value.map(n => n.id)).toEqual(['docs'])
    expect(source.moves).toEqual([{ kind: 'item', id: 'photo', parentId: 'docs', index: 3 }])

    settle()
    await nextTick()
    expect(explorer.actionError.value).toBeNull()
  })

  it('keeps positions consistent, so navigating away and back shows the same order', async () => {
    const explorer = useExplorer(sourceOf())
    await explorer.refresh()

    explorer.drag.begin(explorer.children.value[1]!) // photo
    explorer.drag.dropInto('docs')
    await nextTick()

    explorer.navigate('docs')
    expect(explorer.children.value.map(n => n.id)).toEqual(['deep', 'note', 'sheet', 'photo'])
  })

  it('reloads and reports when the server refuses the move', async () => {
    const source = sourceOf()
    source.move = () => Promise.reject(new Error('conflict'))
    const explorer = useExplorer(source)
    await explorer.refresh()

    explorer.drag.begin(explorer.children.value[1]!)
    explorer.drag.dropInto('docs')
    await flushPromises()
    expect(explorer.actionError.value).toBeInstanceOf(Error)

    // The reload undoes the optimistic move.
    expect(explorer.children.value.map(n => n.id)).toEqual(['docs', 'photo'])
  })

  it('refuses a folder into its own subtree and never calls the source', async () => {
    const source = sourceOf()
    const explorer = useExplorer(source)
    await explorer.refresh()

    explorer.drag.begin(explorer.children.value[0]!) // docs
    explorer.drag.dropInto('deeper')

    expect(source.moves).toEqual([])
    expect(explorer.children.value.map(n => n.id)).toEqual(['docs', 'photo'])
  })

  it('refuses a drop that would nest past the cap', async () => {
    const source = sourceOf()
    const explorer = useExplorer(source, { maxDepth: 2 })
    await explorer.refresh()
    explorer.navigate('docs')

    // deep is two levels tall and docs sits at depth 1, so this lands at 3.
    explorer.drag.begin(explorer.children.value[0]!)
    expect(explorer.drag.canDrop('docs')).toBe(false)
    explorer.drag.dropInto('docs')
    expect(source.moves).toEqual([])
  })

  it('ignores a drop into the folder the node already sits in', async () => {
    const source = sourceOf()
    const explorer = useExplorer(source)
    await explorer.refresh()
    explorer.navigate('docs')

    explorer.drag.begin(explorer.children.value[1]!) // note
    explorer.drag.dropInto('docs')

    expect(source.moves).toEqual([])
  })

  it('asks the source which node may go where, and never calls it for one it refused', async () => {
    const source = sourceOf()
    // note stays where it is, and nothing is filed into deep.
    source.canMove = (node, parentId) => node.id !== 'note' && parentId !== 'deep'
    const explorer = useExplorer(source)
    await explorer.refresh()
    explorer.navigate('docs')
    const [, note, sheet] = explorer.children.value

    expect(explorer.canDrag(note!)).toBe(false)
    expect(explorer.canDrag(sheet!)).toBe(true)

    explorer.drag.begin(sheet!)
    expect(explorer.drag.canDrop('deep')).toBe(false)
    explorer.drag.dropInto('deep')

    explorer.drag.begin(note!)
    explorer.drag.previewReorder(sheet!.id, true)
    explorer.drag.commitReorder()

    expect(source.moves).toEqual([])
    expect(explorer.children.value.map(n => n.id)).toEqual(['deep', 'note', 'sheet'])
  })

  it('does not drag at all when the source cannot move', async () => {
    const explorer = useExplorer({ load: () => Promise.resolve(seed()) })
    await explorer.refresh()

    explorer.drag.begin(explorer.children.value[1]!)
    expect(explorer.drag.canDrop('docs')).toBe(false)
  })
})

describe('reordering inside a folder', () => {
  it('previews the new order and persists the index it settled on', async () => {
    const source = sourceOf()
    const explorer = useExplorer(source)
    await explorer.refresh()
    explorer.navigate('docs')

    const [, note, sheet] = explorer.children.value
    explorer.drag.begin(note!)
    explorer.drag.previewReorder(sheet!.id, true)
    expect(explorer.children.value.map(n => n.id)).toEqual(['deep', 'sheet', 'note'])

    explorer.drag.commitReorder()
    expect(source.moves).toEqual([{ kind: 'item', id: 'note', parentId: 'docs', index: 2 }])
  })

  it('keeps folders grouped ahead of items while previewing', async () => {
    const explorer = useExplorer(sourceOf())
    await explorer.refresh()
    explorer.navigate('docs')

    const [deep, note] = explorer.children.value
    explorer.drag.begin(note!)
    explorer.drag.previewReorder(deep!.id, false)

    // An item never sorts ahead of a folder.
    expect(explorer.children.value.map(n => n.kind)).toEqual(['folder', 'item', 'item'])
  })

  it('commits the previewed order when the drag ends outside a drop target', async () => {
    const source = sourceOf()
    const explorer = useExplorer(source)
    await explorer.refresh()
    explorer.navigate('docs')

    const [, note, sheet] = explorer.children.value
    explorer.drag.begin(note!)
    explorer.drag.previewReorder(sheet!.id, true)
    explorer.drag.finish()

    expect(source.moves).toHaveLength(1)
    expect(explorer.drag.active.value).toBe(false)
  })

  it('writes nothing when a drag ends where it started', async () => {
    const source = sourceOf()
    const explorer = useExplorer(source)
    await explorer.refresh()
    explorer.navigate('docs')

    explorer.drag.begin(explorer.children.value[1]!) // note
    explorer.drag.finish()

    expect(source.moves).toEqual([])
  })

  it('does not persist twice when a handled drop is followed by dragend', async () => {
    const source = sourceOf()
    const explorer = useExplorer(source)
    await explorer.refresh()

    explorer.drag.begin(explorer.children.value[1]!)
    explorer.drag.dropInto('docs')
    explorer.drag.finish()

    expect(source.moves).toHaveLength(1)
  })
})

describe('folder actions', () => {
  it('creates, renames and deletes through the source, then reloads', async () => {
    const source = sourceOf()
    const create = vi.fn(() => Promise.resolve())
    const rename = vi.fn(() => Promise.resolve())
    const remove = vi.fn(() => Promise.resolve())
    source.createFolder = create
    source.renameFolder = rename
    source.deleteFolder = remove

    const explorer = useExplorer(source)
    await explorer.refresh()
    explorer.navigate('docs')

    await explorer.createFolder({ name: 'new', accent: 'blue', parentId: 'docs' })
    await explorer.renameFolder('deep', { name: 'renamed', accent: '', parentId: 'docs' })
    await explorer.deleteFolder('deep', true)

    expect(create).toHaveBeenCalledWith({ name: 'new', accent: 'blue', parentId: 'docs' })
    expect(rename).toHaveBeenCalledWith('deep', { name: 'renamed', accent: '', parentId: 'docs' })
    expect(remove).toHaveBeenCalledWith('deep', true)
  })

  it('leaves the current folder when it is the one being deleted', async () => {
    const nodes = seed()
    const source = sourceOf(nodes)
    const explorer = useExplorer(source)
    await explorer.refresh()
    explorer.navigate('deep')

    source.deleteFolder = (id) => {
      nodes.splice(nodes.findIndex(n => n.id === id), 1)
      return Promise.resolve()
    }
    await explorer.deleteFolder('deep', true)

    expect(explorer.currentId.value).toBe('docs')
  })

  it('reports a failed action and rethrows, so a caller can react too', async () => {
    const source = sourceOf()
    source.createFolder = () => Promise.reject(new Error('name taken'))
    const explorer = useExplorer(source)
    await explorer.refresh()

    await expect(explorer.createFolder({ name: 'x', accent: '', parentId: null }))
      .rejects.toThrow('name taken')
    expect(explorer.actionError.value).toBeInstanceOf(Error)
    // A failed action leaves the tree intact; the grid keeps rendering.
    expect(explorer.error.value).toBeNull()
  })

  it('says which method is missing rather than failing silently', async () => {
    const explorer = useExplorer({ load: () => Promise.resolve(seed()) })
    await explorer.refresh()

    expect(() => explorer.createFolder({ name: 'x', accent: '', parentId: null }))
      .toThrow(/createFolder/)
  })
})

describe('instance cache', () => {
  it('is off by default, so two screens do not share a current folder', async () => {
    const a = useExplorer(sourceOf())
    const b = useExplorer(sourceOf())
    await a.refresh()
    a.navigate('docs')

    expect(b.currentId.value).toBeNull()
  })

  it('returns the same instance for a key, so navigating away and back keeps the folder', async () => {
    const a = useExplorer(sourceOf(), { key: 'files' })
    await a.refresh()
    a.navigate('docs')

    const b = useExplorer(sourceOf(), { key: 'files' })
    expect(b.currentId.value).toBe('docs')

    disposeExplorer('files')
    expect(useExplorer(sourceOf(), { key: 'files' }).currentId.value).toBeNull()
  })
})
