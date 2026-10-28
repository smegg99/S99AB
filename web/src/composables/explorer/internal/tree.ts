// web/src/composables/explorer/internal/tree.ts

// Non-reactive explorer tree functions over the whole flat array, which breadcrumbs
// and the depth-cap check both need.

export type ExplorerKind = 'folder' | 'item'

/** One tree row; `data` carries the app's own record. */
export interface ExplorerNode<T = unknown> {
  id: string
  parentId: string | null
  kind: ExplorerKind
  name: string
  /** Order among siblings; ties and absence fall back to the name. */
  position?: number
  /** Folder tint: a name with a declared --s99ab-accent-<name>. */
  accent?: string
  /** Overrides the kind's icon. */
  icon?: string
  /** Cover image. */
  image?: string
  /** Corner badge; a folder shows its child count when unset. */
  badge?: string | number
  /** Dimmed; refuses opening, dragging, selection and drops. */
  disabled?: boolean
  /** Sorted to the front of its folder. See ExplorerSource.pin. */
  pinned?: boolean
  data?: T
}

export type ExplorerCompare<T = unknown> = (
  a: ExplorerNode<T>,
  b: ExplorerNode<T>,
) => number

export interface ExplorerOrder<T = unknown> {
  /** Folders ahead of items. Default true. */
  foldersFirst?: boolean
  sort?: ExplorerCompare<T>
}

function byPositionThenName<T>(a: ExplorerNode<T>, b: ExplorerNode<T>): number {
  return (a.position ?? 0) - (b.position ?? 0) || a.name.localeCompare(b.name)
}

export function indexById<T>(
  nodes: readonly ExplorerNode<T>[],
): Map<string, ExplorerNode<T>> {
  const map = new Map<string, ExplorerNode<T>>()
  for (const node of nodes) map.set(node.id, node)
  return map
}

/** Every node grouped under its parent and ordered, in one pass. */
export function groupByParent<T>(
  nodes: readonly ExplorerNode<T>[],
  order: ExplorerOrder<T> = {},
): Map<string | null, ExplorerNode<T>[]> {
  const groups = new Map<string | null, ExplorerNode<T>[]>()
  for (const node of nodes) {
    const key = node.parentId ?? null
    const group = groups.get(key)
    if (group) group.push(node)
    else groups.set(key, [node])
  }

  const compare = order.sort ?? byPositionThenName
  const foldersFirst = order.foldersFirst ?? true

  // Stable sorts in reverse precedence: app order, folders first, then pinned first.
  for (const group of groups.values()) {
    group.sort(compare)
    if (foldersFirst) {
      group.sort(
        (a, b) => Number(a.kind === 'item') - Number(b.kind === 'item'),
      )
    }
    group.sort((a, b) => Number(!a.pinned) - Number(!b.pinned))
  }
  return groups
}

export function childrenOf<T>(
  nodes: readonly ExplorerNode<T>[],
  parentId: string | null,
  order: ExplorerOrder<T> = {},
): ExplorerNode<T>[] {
  return groupByParent(nodes, order).get(parentId) ?? []
}

/** The node and its ancestors, root first; stops on a cycle. */
export function pathOf<T>(
  nodes: readonly ExplorerNode<T>[],
  id: string | null,
): ExplorerNode<T>[] {
  if (!id) return []
  const map = indexById(nodes)
  const path: ExplorerNode<T>[] = []
  const seen = new Set<string>()

  let current = map.get(id)
  while (current && !seen.has(current.id)) {
    seen.add(current.id)
    path.unshift(current)
    current = current.parentId ? map.get(current.parentId) : undefined
  }
  return path
}

/** The root is 0, a folder directly in it is 1. */
export function depthOf<T>(
  nodes: readonly ExplorerNode<T>[],
  id: string | null,
): number {
  return pathOf(nodes, id).length
}

/** Folder levels at and below a folder, counting itself as 1; items are ignored. */
export function subtreeHeight<T>(
  nodes: readonly ExplorerNode<T>[],
  id: string,
): number {
  const groups = groupByParent(nodes)

  function walk(current: string, seen: Set<string>): number {
    if (seen.has(current)) return 1
    seen.add(current)
    let tallest = 1
    for (const child of groups.get(current) ?? []) {
      if (child.kind !== 'folder') continue
      tallest = Math.max(tallest, 1 + walk(child.id, seen))
    }
    return tallest
  }

  return walk(id, new Set())
}

export function isDescendant<T>(
  nodes: readonly ExplorerNode<T>[],
  id: string,
  ancestorId: string,
): boolean {
  return pathOf(nodes, id).some(
    node => node.id === ancestorId && node.id !== id,
  )
}

/**
 * Whether a node may move into a container: not into its own subtree, within maxDepth
 * including its subtree height, and neither end disabled (a drop can come from a crumb).
 */
export function canMoveInto<T>(
  nodes: readonly ExplorerNode<T>[],
  node: ExplorerNode<T>,
  parentId: string | null,
  maxDepth: number,
): boolean {
  if (node.disabled) return false
  if (parentId !== null) {
    const parent = indexById(nodes).get(parentId)
    if (!parent || parent.kind !== 'folder' || parent.disabled) return false
  }
  if (node.kind !== 'folder') return true
  if (node.id === parentId) return false
  if (parentId !== null && isDescendant(nodes, parentId, node.id)) return false

  return depthOf(nodes, parentId) + subtreeHeight(nodes, node.id) <= maxDepth
}
