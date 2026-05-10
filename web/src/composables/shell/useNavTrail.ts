// web/src/composables/shell/useNavTrail.ts

import type { Ref } from 'vue'
import type { NavGroup, NavLink } from '../../types'
import { computed, ref, watch } from 'vue'
import { useRoute } from 'vue-router'
import { useCssNumber } from '../useCssNumber'
import { anchorsIn, useScrollSpy } from './useScrollSpy'

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

function heightOf(row: TrailRow, m: TrailMetrics): number {
  return row.kind === 'head' ? m.head : m.row
}

/**
 * Stacks the rows once, returning each node and the total height, so the SVG
 * matches the list exactly. Follows the CSS order: row-gap, then heading margins.
 */
function stack(rows: TrailRow[], m: TrailMetrics): { nodes: TrailNode[], height: number } {
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

/** The rail's geometry and the disc's position. Dimensions come from useCssNumber, so themer changes redraw it. */
export function useNavTrail(groups: () => NavGroup[], active: Ref<number | undefined>) {
  // Without a router provider there is no active row.
  const route = useRoute() as ReturnType<typeof useRoute> | undefined

  const row = useCssNumber('--s99ab-nav-trail-row', 36)
  const head = useCssNumber('--s99ab-nav-trail-head', 28)
  const rowGap = useCssNumber('--s99ab-nav-trail-row-gap', 2)
  const groupAbove = useCssNumber('--s99ab-nav-trail-group-above', 12)
  const groupBare = useCssNumber('--s99ab-nav-trail-group-bare', 0)
  const groupBelow = useCssNumber('--s99ab-nav-trail-group-below', 4)
  const indent = useCssNumber('--s99ab-nav-trail-indent', 16)
  const x = useCssNumber('--s99ab-nav-trail-x', 14)
  const bend = useCssNumber('--s99ab-nav-trail-bend', 8)
  const dotSize = useCssNumber('--s99ab-nav-trail-dot', 11)
  const gap = useCssNumber('--s99ab-nav-trail-gap', 8)
  const reach = useCssNumber('--s99ab-nav-trail-reach', 0)
  const halo = useCssNumber('--s99ab-nav-trail-halo', 0)

  const rows = computed(() => flattenNav(groups()))

  const metrics = computed<TrailMetrics>(() => ({
    row: row.value,
    head: head.value,
    rowGap: rowGap.value,
    groupAbove: groupAbove.value,
    groupBare: groupBare.value,
    groupBelow: groupBelow.value,
    indent: indent.value,
    x: x.value,
    bend: bend.value,
  }))

  const nodes = computed(() => trailNodes(rows.value, metrics.value))

  /** The drawn stretch, first destination to last; a leading heading gets no stub. */
  const drawn = computed(() => {
    const list = nodes.value
    const first = rows.value.findIndex(row => row.kind === 'link')
    if (first < 0) return []

    let last = rows.value.length - 1
    while (last > first && rows.value[last]!.kind !== 'link') last--

    return list.slice(first, last + 1)
  })

  const path = computed(() => trailPath(drawn.value, metrics.value.bend, reach.value))
  const height = computed(() => trailHeight(rows.value, metrics.value))

  // Half a disc (or its halo) past the deepest node, so it is not clipped.
  const width = computed(() =>
    Math.max(x.value, ...nodes.value.map(n => n.x)) + dotSize.value / 2 + halo.value,
  )

  /**
   * The SVG box: the list plus the rail's reach past each end, drawn outside
   * the list so reaching an edge costs no height.
   */
  const box = computed(() => {
    const list = drawn.value
    const head = reach.value * (list[0]?.half ?? 0)
    const tail = reach.value * (list[list.length - 1]?.half ?? 0)

    // Avoids `-0`, which would reach the style as `-0px`.
    const top = head ? -head : 0

    return {
      top,
      height: height.value + head + tail,
      viewBox: `0 ${top} ${width.value} ${height.value + head + tail}`,
    }
  })

  /** Where each row begins: just past its own rail segment, so rows only move with depth. */
  const insets = computed(() =>
    nodes.value.map(node => node.x + dotSize.value / 2 + gap.value),
  )

  // The scroll spy, for the anchors on the current page.
  useScrollSpy(() => anchorsIn(
    rows.value.map(row => row.link?.to ?? ''),
    route?.path ?? '',
  ))

  // The current row: the bound model, or the route. The spy writes the URL, so
  // the route already carries its answer without the spy's in-flight freeze.
  const index = computed(() =>
    active.value ?? activeRow(rows.value, route?.path ?? '', route?.fullPath ?? ''),
  )

  const pathEl = ref<SVGPathElement | null>(null)
  const total = ref(0)
  const lengths = ref<number[]>([])

  /**
   * Each row's arc length along the rail, by binary search on y (monotonic).
   * Without getTotalLength (happy-dom) straight-line distances are used.
   */
  function measure() {
    const el = pathEl.value
    const list = nodes.value

    if (!el || typeof el.getTotalLength !== 'function') {
      let run = 0
      lengths.value = list.map((node, i) => {
        const prev = list[i - 1]
        if (prev) run += Math.hypot(node.x - prev.x, node.y - prev.y)
        return run
      })
      total.value = run
      return
    }

    total.value = el.getTotalLength()
    lengths.value = list.map((node) => {
      let lo = 0
      let hi = total.value
      for (let step = 0; step < 24; step++) {
        const mid = (lo + hi) / 2
        if (el.getPointAtLength(mid).y < node.y) lo = mid
        else hi = mid
      }
      return (lo + hi) / 2
    })
  }

  /** The disc's position and how much rail is behind it. The travel is a CSS transition; see .trail__disc in styles/_nav.scss. */
  const dot = ref<TrailPoint>({ x: x.value, y: 0 })
  const travelled = ref(0)

  // Follow the current row, and hold position when there is none, so the disc
  // returns from where it was last seen.
  watch([index, nodes, lengths], () => {
    const node = nodes.value[index.value]
    if (!node) return

    dot.value = { x: node.x, y: node.y }
    travelled.value = lengths.value[index.value] ?? travelled.value
  }, { immediate: true, flush: 'post' })

  // Re-measure when the path or its element changes; lengths are straight-line until pathEl mounts.
  watch([path, pathEl], measure, { flush: 'post', immediate: true })

  return {
    rows,
    nodes,
    path,
    width,
    height,
    metrics,
    dotSize,
    halo,
    box,
    insets,
    index,
    pathEl,
    dot,
    travelled,
    total,
  }
}
