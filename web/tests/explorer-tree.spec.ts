// web/tests/explorer-tree.spec.ts

import { describe, expect, it } from 'vitest'
import {
  canMoveInto,
  childrenOf,
  depthOf,
  type ExplorerNode,
  isDescendant,
  pathOf,
  subtreeHeight,
} from '../src/composables/explorer/internal/tree'

function folder(id: string, parentId: string | null, position = 0, name = id): ExplorerNode {
  return { id, parentId, kind: 'folder', name, position }
}

function item(id: string, parentId: string | null, position = 0, name = id): ExplorerNode {
  return { id, parentId, kind: 'item', name, position }
}

// a
// +-- a1
// |   +-- a1x
// +-- item-a
// b
// item-root
const tree: ExplorerNode[] = [
  folder('a', null, 0),
  folder('b', null, 1),
  folder('a1', 'a', 0),
  folder('a1x', 'a1', 0),
  item('item-a', 'a', 0),
  item('item-root', null, 0),
]

describe('childrenOf', () => {
  it('returns only direct children', () => {
    expect(childrenOf(tree, 'a').map(n => n.id)).toEqual(['a1', 'item-a'])
    expect(childrenOf(tree, 'a1x')).toEqual([])
  })

  it('groups folders before items at the same position', () => {
    expect(childrenOf(tree, null).map(n => n.id)).toEqual(['a', 'b', 'item-root'])
  })

  it('interleaves by position when foldersFirst is off', () => {
    const ids = childrenOf(tree, null, { foldersFirst: false }).map(n => n.id)
    expect(ids).toEqual(['a', 'item-root', 'b'])
  })

  it('orders by position, then name, so an absent position is still stable', () => {
    const nodes: ExplorerNode[] = [
      { id: 'x', parentId: null, kind: 'item', name: 'zebra' },
      { id: 'y', parentId: null, kind: 'item', name: 'apple' },
    ]
    expect(childrenOf(nodes, null).map(n => n.id)).toEqual(['y', 'x'])
  })

  it('takes a custom comparator', () => {
    const byNameDesc = (a: ExplorerNode, b: ExplorerNode) => b.name.localeCompare(a.name)
    expect(childrenOf(tree, null, { sort: byNameDesc }).map(n => n.id)).toEqual(['b', 'a', 'item-root'])
  })
})

describe('pathOf', () => {
  it('returns the ancestors root first, including the node', () => {
    expect(pathOf(tree, 'a1x').map(n => n.id)).toEqual(['a', 'a1', 'a1x'])
  })

  it('is empty at the root', () => {
    expect(pathOf(tree, null)).toEqual([])
  })

  it('is empty for an id that is not in the tree', () => {
    expect(pathOf(tree, 'gone')).toEqual([])
  })

  it('stops instead of looping when a cycle reaches it', () => {
    const cyclic: ExplorerNode[] = [
      { id: 'p', parentId: 'q', kind: 'folder', name: 'p' },
      { id: 'q', parentId: 'p', kind: 'folder', name: 'q' },
    ]
    expect(pathOf(cyclic, 'p').map(n => n.id)).toEqual(['q', 'p'])
  })
})

describe('depthOf and subtreeHeight', () => {
  it('counts the root as zero and a root folder as one', () => {
    expect(depthOf(tree, null)).toBe(0)
    expect(depthOf(tree, 'a')).toBe(1)
    expect(depthOf(tree, 'a1x')).toBe(3)
  })

  it('counts a leaf folder as one level tall', () => {
    expect(subtreeHeight(tree, 'a1x')).toBe(1)
    expect(subtreeHeight(tree, 'a')).toBe(3)
  })

  it('ignores items when measuring height, since they cannot nest', () => {
    expect(subtreeHeight(tree, 'b')).toBe(1)
  })
})

describe('isDescendant', () => {
  it('is true for any depth below', () => {
    expect(isDescendant(tree, 'a1x', 'a')).toBe(true)
    expect(isDescendant(tree, 'a1', 'a')).toBe(true)
  })

  it('is false upwards, sideways, and for itself', () => {
    expect(isDescendant(tree, 'a', 'a1')).toBe(false)
    expect(isDescendant(tree, 'b', 'a')).toBe(false)
    expect(isDescendant(tree, 'a', 'a')).toBe(false)
  })
})

describe('canMoveInto', () => {
  const a = tree[0]!
  const a1 = tree[2]!

  it('allows a folder into an unrelated folder', () => {
    expect(canMoveInto(tree, a1, 'b', 8)).toBe(true)
  })

  it('allows a move back to the root', () => {
    expect(canMoveInto(tree, a1, null, 8)).toBe(true)
  })

  it('refuses a folder into itself or its own descendant', () => {
    expect(canMoveInto(tree, a, 'a', 8)).toBe(false)
    expect(canMoveInto(tree, a, 'a1x', 8)).toBe(false)
  })

  it('refuses a move whose resulting nesting exceeds the cap', () => {
    // b is at depth 1 and a is three levels tall, so the deepest node lands at 4.
    expect(canMoveInto(tree, a, 'b', 4)).toBe(true)
    expect(canMoveInto(tree, a, 'b', 3)).toBe(false)
  })

  it('lets an item into a folder already at the cap, since items do not nest', () => {
    const leaf = tree[4]!
    expect(canMoveInto(tree, leaf, 'a1x', 3)).toBe(true)
  })

  it('refuses a parent that is not in the tree', () => {
    expect(canMoveInto(tree, a1, 'gone', 8)).toBe(false)
  })

  it('refuses an item as a parent', () => {
    expect(canMoveInto(tree, a1, 'item-root', 8)).toBe(false)
  })
})
