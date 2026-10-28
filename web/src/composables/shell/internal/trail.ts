// web/src/composables/shell/internal/trail.ts

import type { NavGroup, NavLink } from '../../../types'

/**
 * One row of the trail, in render order. A heading is a row because it takes
 * vertical space, but it is not a stop.
 */
export interface TrailRow {
  kind: 'head' | 'link'
  /** Stable across a reorder: the link, or the heading's label. */
  key: string
  depth: number
  label: string
  /** Absent on a heading. */
  link?: NavLink
  /**
   * Opens a group and takes its clearance: on the heading, or on the first
   * destination of an unlabelled group. Never on the very first row.
   */
  startsGroup?: boolean
}

/** Groups and their nested children, flattened into the order they are drawn. */
export function flattenNav(groups: NavGroup[]): TrailRow[] {
  const rows: TrailRow[] = []

  function walk(links: NavLink[], depth: number) {
    for (const link of links) {
      rows.push({ kind: 'link', key: link.to, depth, label: link.label, link })
      if (link.children?.length) walk(link.children, depth + 1)
    }
  }

  for (const [i, group] of groups.entries()) {
    const opens = rows.length > 0

    // An unlabelled group gets no heading row, but its run is still a group.
    if (group.label) {
      rows.push({
        kind: 'head',
        key: `head:${group.label}:${i}`,
        depth: 0,
        label: group.label,
        startsGroup: opens,
      })
    }

    const first = rows.length
    walk(group.items, 0)
    if (!group.label && opens && rows[first]) rows[first]!.startsGroup = true
  }

  return rows
}

/** The rail geometry, from the --s99ab-nav-trail-* properties. */
export interface TrailMetrics {
  row: number
  head: number
  rowGap: number
  groupAbove: number
  groupBare: number
  groupBelow: number
  indent: number
  x: number
  bend: number
}

/** A point on the rail. The disc is one and belongs to no row. */
export interface TrailPoint { x: number, y: number }

export interface TrailNode extends TrailPoint {
  /** Half this row's height. */
  half: number
}

export function heightOf(row: TrailRow, m: TrailMetrics): number {
  return row.kind === 'head' ? m.head : m.row
}

/**
 * Stacks the rows once, returning each node and the total height, so the SVG
 * matches the list exactly. Follows the CSS order: row-gap, then heading margins.
 */
export function stack(rows: TrailRow[], m: TrailMetrics): { nodes: TrailNode[], height: number } {
  const nodes: TrailNode[] = []
  let top = 0

  rows.forEach((row, i) => {
    if (i > 0) top += m.rowGap
    // The group opener takes heading or bare clearance. flattenNav never marks the first row.
    if (row.startsGroup) top += row.kind === 'head' ? m.groupAbove : m.groupBare

    const height = heightOf(row, m)
    nodes.push({ x: m.x + row.depth * m.indent, y: top + height / 2, half: height / 2 })
    top += height

    if (row.kind === 'head') top += m.groupBelow
  })

  return { nodes, height: top }
}

export function trailHeight(rows: TrailRow[], m: TrailMetrics): number {
  return stack(rows, m).height
}

/** Where each row's node sits; y is a running sum over two row heights and group clearances. */
export function trailNodes(rows: TrailRow[], m: TrailMetrics): TrailNode[] {
  return stack(rows, m).nodes
}

/**
 * The rail: vertical runs joined by rounded S-bends where depth changes, one
 * path for the whole nav. Each bend sits inside the deeper row's span, since
 * the shallower row's face only clears its own segment.
 */
export function trailPath(nodes: TrailNode[], bend: number, reach = 0): string {
  const first = nodes[0]
  const last = nodes[nodes.length - 1]
  if (!first || !last) return ''

  // Each end's reach is a fraction of its own row's half-height.
  const head = reach * first.half
  const tail = reach * last.half

  let d = `M ${first.x} ${first.y - head}`
  if (head) d += ` L ${first.x} ${first.y}`

  for (let i = 1; i < nodes.length; i++) {
    const from = nodes[i - 1]!
    const to = nodes[i]!

    if (from.x === to.x) {
      d += ` L ${to.x} ${to.y}`
      continue
    }

    const span = to.y - from.y
    const step = Math.abs(to.x - from.x)
    const dir = to.x > from.x ? 1 : -1

    // Two arcs need 2r of room each way, capped by the indent and by the room
    // left after the shallower row's face, so y stays monotonic along the path.
    const shallowHalf = dir === 1 ? from.half : to.half
    const r = Math.max(Math.min(bend, step / 2, (span - shallowHalf) / 2), 0)

    // Against the deeper row: the last 2r going in, the first 2r coming out.
    const mid = dir === 1 ? to.y - r : from.y + r

    // A zero-radius `A` renders as a line, which is fine below half a pixel.
    const [sweepIn, sweepOut] = dir === 1 ? [0, 1] : [1, 0]

    d += ` L ${from.x} ${mid - r}`
    d += ` A ${r} ${r} 0 0 ${sweepIn} ${from.x + r * dir} ${mid}`
    d += ` L ${to.x - r * dir} ${mid}`
    d += ` A ${r} ${r} 0 0 ${sweepOut} ${to.x} ${mid + r}`
    d += ` L ${to.x} ${to.y}`
  }

  if (tail) d += ` L ${last.x} ${last.y + tail}`

  return d
}

/**
 * Which row the current location is on, or -1: the longest `to` the path is
 * inside, on a segment boundary. `newTab` rows never light. A `to` with a hash
 * matches the full path exactly, so anchors on one page do not all light.
 */
export function activeRow(rows: TrailRow[], path: string, fullPath: string = path): number {
  let best = -1
  let bestLength = -1

  for (const [i, row] of rows.entries()) {
    const link = row.link
    if (!link || link.newTab) continue

    const to = link.to
    let hit: boolean

    if (to.includes('#')) hit = fullPath === to
    else if (link.exact) hit = path === to
    else hit = path === to || path.startsWith(to === '/' ? '/' : `${to}/`)

    if (hit && to.length > bestLength) {
      best = i
      bestLength = to.length
    }
  }

  return best
}
