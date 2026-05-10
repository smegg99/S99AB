// web/tests/explorer-events.spec.ts

import { effectScope } from 'vue'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import {
  disposeExplorer,
  type ExplorerSource,
  useExplorer,
} from '../src/composables/explorer/useExplorer'
import {
  bindExplorerEvents,
  createExplorerEvents,
} from '../src/composables/explorer/useExplorerEvents'
import type { ExplorerNode } from '../src/composables/explorer/useExplorerTree'

function seed(): ExplorerNode[] {
  return [
    { id: 'docs', parentId: null, kind: 'folder', name: 'docs', position: 0 },
    { id: 'note', parentId: 'docs', kind: 'item', name: 'note', position: 0 },
    { id: 'photo', parentId: null, kind: 'item', name: 'photo', position: 0 },
  ]
}

function sourceOf(nodes: ExplorerNode[] = seed()): ExplorerSource {
  return {
    load: () => Promise.resolve([...nodes]),
    move: () => Promise.resolve(),
    createFolder: () => Promise.resolve(),
    renameFolder: () => Promise.resolve(),
    deleteFolder: () => Promise.resolve(),
  }
}

beforeEach(() => {
  disposeExplorer()
})

describe('the emitter', () => {
  it('stops delivering once the subscription is dropped', () => {
    const events = createExplorerEvents()
    const heard = vi.fn()

    const off = events.on('navigate', heard)
    events.emit('navigate', 'docs', null)
    off()
    events.emit('navigate', null, null)

    expect(heard).toHaveBeenCalledTimes(1)
  })

  // A listener unsubscribing during emit must not cause the next one to be skipped.
  it('delivers to everyone even when one leaves mid-emit', () => {
    const events = createExplorerEvents()
    const second = vi.fn()

    const off = events.on('navigate', () => off())
    events.on('navigate', second)
    events.emit('navigate', null, null)

    expect(second).toHaveBeenCalledOnce()
  })

  // A keyed explorer outlives its component, so scope subscriptions are dropped with the scope.
  it('drops what a scope subscribed when the scope goes', () => {
    const events = createExplorerEvents()
    const heard = vi.fn()

    const scope = effectScope()
    scope.run(() => bindExplorerEvents(events, { navigate: heard }))
    events.emit('navigate', 'docs', null)
    scope.stop()
    events.emit('navigate', null, null)

    expect(heard).toHaveBeenCalledTimes(1)
  })
})

describe('what an explorer announces', () => {
  it('reports where it went, and says nothing about staying put', async () => {
    const explorer = useExplorer(sourceOf())
    await explorer.refresh()
    const heard = vi.fn()
    explorer.events.on('navigate', heard)

    explorer.navigate('docs')
    explorer.navigate('docs')
    explorer.up()

    expect(heard).toHaveBeenCalledTimes(2)
    expect(heard).toHaveBeenNthCalledWith(1, 'docs', expect.objectContaining({ id: 'docs' }))
    expect(heard).toHaveBeenNthCalledWith(2, null, null)
  })

  // The open folder was deleted elsewhere, so the reload lands somewhere unrequested.
  it('reports the landing when a reload loses the open folder', async () => {
    const nodes = seed()
    const source: ExplorerSource = { load: () => Promise.resolve([...nodes]) }
    const explorer = useExplorer(source)
    await explorer.refresh()
    explorer.navigate('docs')

    const heard = vi.fn()
    explorer.events.on('navigate', heard)
    nodes.splice(0, nodes.length, { id: 'photo', parentId: null, kind: 'item', name: 'photo' })
    await explorer.refresh()

    expect(heard).toHaveBeenCalledWith(null, null)
  })

  it('reports a move where the grid changed, not where the request landed', async () => {
    const explorer = useExplorer(sourceOf())
    await explorer.refresh()
    const heard = vi.fn()
    explorer.events.on('move', heard)

    explorer.drag.begin(explorer.children.value[1]!) // photo
    explorer.drag.dropInto('docs')

    expect(heard).toHaveBeenCalledWith(
      expect.objectContaining({ id: 'photo', parentId: 'docs' }),
      expect.objectContaining({ id: 'photo' }),
    )
  })

  it('reports each folder action once the source has taken it', async () => {
    const explorer = useExplorer(sourceOf())
    await explorer.refresh()
    const created = vi.fn()
    const renamed = vi.fn()
    const removed = vi.fn()
    explorer.events.on('create', created)
    explorer.events.on('rename', renamed)
    explorer.events.on('remove', removed)

    const input = { name: 'new', accent: '', parentId: null }
    await explorer.createFolder(input)
    await explorer.renameFolder('docs', { ...input, name: 'renamed' })
    await explorer.deleteFolder('docs', true)

    expect(created).toHaveBeenCalledWith(input)
    expect(renamed).toHaveBeenCalledWith('docs', expect.objectContaining({ name: 'renamed' }))
    expect(removed).toHaveBeenCalledWith('docs', true)
  })

  it('reports a refused action, and a refused move after the reload', async () => {
    const boom = new Error('nope')
    const explorer = useExplorer({
      load: () => Promise.resolve(seed()),
      move: () => Promise.reject(boom),
      deleteFolder: () => Promise.reject(boom),
    })
    await explorer.refresh()
    const failed = vi.fn()
    explorer.events.on('error', failed)

    await expect(explorer.deleteFolder('docs')).rejects.toThrow('nope')

    explorer.drag.begin(explorer.children.value[1]!)
    explorer.drag.dropInto('docs')
    await vi.waitFor(() => expect(failed).toHaveBeenCalledTimes(2))

    expect(failed).toHaveBeenCalledWith(boom)
  })
})
