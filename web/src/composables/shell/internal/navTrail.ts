// web/src/composables/shell/internal/navTrail.ts

import type { Ref } from 'vue'
import { computed, ref, watch } from 'vue'
import { useRoute } from 'vue-router'
import { useCssNumber } from '../../useCssNumber'
import { useScrollSpy } from '../useScrollSpy'
import { anchorsIn } from './anchors'
import { flattenNav, type TrailMetrics, type TrailPoint, trailHeight, trailNodes, trailPath, activeRow } from './trail'
import type { NavGroup } from '../../../types'

export type { TrailMetrics, TrailNode, TrailPoint, TrailRow } from './trail'

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
