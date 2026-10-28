// web/tests/navTrail.spec.ts

import { defineComponent, h, nextTick, ref } from 'vue'
import { afterEach, describe, expect, it } from 'vitest'
import { mount } from '@vue/test-utils'
import { createMemoryHistory, createRouter } from 'vue-router'
import { useNavTrail } from '../src/composables/shell/internal/navTrail'
import { activeRow, flattenNav, trailHeight, trailNodes, trailPath } from '../src/composables/shell/internal/trail'
import { configureMotion, resetMotion } from '../src/composables/motion/internal/motion'
import type { NavGroup } from '../src/types'

const NESTED: NavGroup[] = [
  {
    label: 'Surfaces',
    items: [
      {
        to: '/textures',
        label: 'Textures',
        icon: 'mdi-texture-box',
        children: [
          { to: '/textures/grain', label: 'Grain' },
          { to: '/textures/paper', label: 'Paper' },
        ],
      },
      { to: '/panels', label: 'Panels', icon: 'mdi-card-outline' },
    ],
  },
  { items: [{ to: '/about', label: 'About' }] },
]

describe('flattenNav', () => {
  it('emits rows in render order', () => {
    expect(flattenNav(NESTED).map(r => r.label)).toEqual([
      'Surfaces',
      'Textures',
      'Grain',
      'Paper',
      'Panels',
      'About',
    ])
  })

  it('puts a child one level in and returns to the parent depth after it', () => {
    expect(flattenNav(NESTED).map(r => r.depth)).toEqual([0, 0, 1, 1, 0, 0])
  })

  it('marks a group label as a heading and a destination as a link', () => {
    const rows = flattenNav(NESTED)
    expect(rows[0]!.kind).toBe('head')
    expect(rows[1]!.kind).toBe('link')
    expect(rows[1]!.link?.to).toBe('/textures')
  })

  // A group with no label is the flat case and gets no heading row.
  it('emits no heading for an unlabelled group', () => {
    expect(flattenNav(NESTED).filter(r => r.kind === 'head')).toHaveLength(1)
  })

  it('keys a row by its destination, so a reorder does not reuse the wrong row', () => {
    const keys = flattenNav(NESTED).map(r => r.key)
    expect(new Set(keys).size).toBe(keys.length)
    expect(keys).toContain('/textures/grain')
  })
})

const M = {
  row: 40,
  head: 20,
  rowGap: 0,
  groupAbove: 0,
  groupBare: 0,
  groupBelow: 0,
  indent: 20,
  x: 10,
  bend: 10,
}

describe('trailNodes', () => {
  it('centres a row on its own height, and stacks by the kind of row above', () => {
    const nodes = trailNodes(flattenNav(NESTED), M)

    // head(20) then link(40): 10, then 20 + 20, then 40 + 40.
    expect(nodes[0]!.y).toBe(10)
    expect(nodes[1]!.y).toBe(40)
    expect(nodes[2]!.y).toBe(80)
  })

  it('offsets x by depth', () => {
    const nodes = trailNodes(flattenNav(NESTED), M)
    expect(nodes[1]!.x).toBe(10)
    expect(nodes[2]!.x).toBe(30)
  })

  // The list has a row gap, so the rail must include it or nodes drift from their labels.
  it('accumulates the row gap between one node and the next', () => {
    const nodes = trailNodes(flattenNav(NESTED), { ...M, rowGap: 6 })

    expect(nodes[0]!.y).toBe(10)
    expect(nodes[1]!.y).toBe(46)
    expect(nodes[2]!.y).toBe(92)
  })
})

describe('trailHeight', () => {
  it('is the rows plus a gap between each pair, and none after the last', () => {
    const rows = flattenNav(NESTED)

    expect(trailHeight(rows, M)).toBe(20 + 5 * 40)
    expect(trailHeight(rows, { ...M, rowGap: 6 })).toBe(20 + 5 * 40 + 5 * 6)
  })

  it('is nothing for a nav with no rows', () => {
    expect(trailHeight([], M)).toBe(0)
  })

  // Height and nodes come from one accumulation, so they agree on group boundaries.
  it('counts a group heading\'s own clearance', () => {
    const rows = flattenNav(NESTED)
    const spaced = { ...M, groupAbove: 12, groupBelow: 4 }

    // The leading heading takes only its clearance below; the unlabelled second group takes none.
    expect(trailHeight(rows, spaced)).toBe(trailHeight(rows, M) + 4)
  })
})

describe('flattenNav, on unlabelled groups', () => {
  const RUNS: NavGroup[] = [
    { items: [{ to: '/', label: 'Home' }] },
    { items: [{ to: '/files', label: 'Files' }, { to: '/jobs', label: 'Jobs' }] },
  ]

  it('marks the first row of every group but the first', () => {
    expect(flattenNav(RUNS).map(r => !!r.startsGroup)).toEqual([false, true, false])
  })

  // Its own knob, 0 by default, so an unlabelled group leaves no empty band.
  it('takes no clearance for an unlabelled group by default', () => {
    const rows = flattenNav(RUNS)

    expect(trailHeight(rows, { ...M, groupAbove: 12 })).toBe(trailHeight(rows, M))
  })

  it('takes it when a nav asks for the runs to be spaced anyway', () => {
    const rows = flattenNav(RUNS)

    expect(trailHeight(rows, { ...M, groupBare: 10 })).toBe(trailHeight(rows, M) + 10)
  })

  it('marks the heading instead where a group has one', () => {
    const marked = flattenNav(NESTED).filter(r => r.startsGroup)

    expect(marked).toHaveLength(1)
    expect(marked[0]!.label).toBe('About')
  })
})

describe('trailNodes, around a group heading', () => {
  const GROUPED: NavGroup[] = [
    { items: [{ to: '/', label: 'Home' }] },
    { label: 'Files', items: [{ to: '/files', label: 'All' }] },
  ]

  it('clears a heading above and below, on top of the row gap', () => {
    const rows = flattenNav(GROUPED)
    const spaced = { ...M, rowGap: 2, groupAbove: 12, groupBelow: 4 }
    const [home, files, all] = trailNodes(rows, spaced)

    // 40, then 2 + 12 of clearance before the heading's own 20.
    expect(files!.y - home!.y).toBe(20 + 2 + 12 + 10)
    // The heading's 20, then 4 + 2 before the row's own 40.
    expect(all!.y - files!.y).toBe(10 + 4 + 2 + 20)
  })

  it('gives no leading clearance to a heading that opens the nav', () => {
    const rows = flattenNav([{ label: 'Files', items: [{ to: '/files', label: 'All' }] }])
    const spaced = { ...M, groupAbove: 12, groupBelow: 4 }

    expect(trailNodes(rows, spaced)[0]!.y).toBe(10)
  })
})

/** A node with no face around it, for the cases that are only about the path. */
const at = (x: number, y: number, half = 0) => ({ x, y, half })

describe('trailPath', () => {
  it('is empty for no rows', () => {
    expect(trailPath([], 10)).toBe('')
  })

  it('draws a straight run as one L per node', () => {
    const d = trailPath([at(10, 10), at(10, 50), at(10, 90)], 10)
    expect(d).toBe('M 10 10 L 10 50 L 10 90')
  })

  // The bend sits against the deeper row; a centred bend would cross the shallower row's face.
  it('bends into a deeper level over the last 2r of the run', () => {
    const d = trailPath([at(10, 10), at(30, 50)], 10)

    expect(d).toContain('L 10 30')
    expect(d).toContain('A 10 10 0 0 0 20 40')
    expect(d).toContain('A 10 10 0 0 1 30 50')
  })

  it('bends back out over the first 2r, which is again the deeper end', () => {
    const d = trailPath([at(30, 10), at(10, 50)], 10)

    expect(d).toContain('A 10 10 0 0 1 20 20')
    expect(d).toContain('A 10 10 0 0 0 10 30')
  })

  // The bend starts past the shallower row's face.
  it('leaves the shallower row its face', () => {
    const going = trailPath([at(10, 10, 18), at(30, 48, 18)], 10)
    const coming = trailPath([at(30, 10, 18), at(10, 44, 14)], 10)

    // (38 - 18) / 2 = 10, so the bend starts at 48 - 20 = 28, ten past the
    // shallower row's face bottom at 10 + 18.
    expect(going).toContain('L 10 28')
    // (34 - 14) / 2 = 10 the other way: it is over by 10 + 20, fourteen short
    // of the shallower row's face top at 44 - 14.
    expect(coming).toContain('A 10 10 0 0 0 10 30')
  })

  // Two arcs of radius r need 2r of vertical room, or the path doubles back.
  it('caps the bend at half the vertical span', () => {
    const d = trailPath([at(10, 10), at(30, 22)], 10)
    expect(d).toContain('A 6 6 0 0 0')
  })

  // Two arcs also need 2r of sideways room, or the arc length stops rising with y,
  // which the disc's measurement relies on.
  it('caps the bend at half the sideways step', () => {
    const d = trailPath([at(10, 10), at(24, 60)], 10)

    expect(d).toContain('A 7 7 0 0 0 17 53')
    expect(d).toContain('L 17 53')
  })

  // With no room the path still climbs in y, so the disc can be placed on it.
  it('collapses to an elbow rather than a negative radius', () => {
    const d = trailPath([at(10, 10, 18), at(30, 20, 18)], 10)

    expect(d).toContain('A 0 0')
    expect(d).toContain('L 30 20')
  })

  // `reach` 0 stops on the end buttons' centres, 1 on their outer edges.
  it('stops on the centre of the end rows at reach 0', () => {
    expect(trailPath([at(10, 20, 18), at(10, 60, 18)], 10)).toBe('M 10 20 L 10 60')
  })

  it('carries to the outer edge of the end rows at reach 1', () => {
    const d = trailPath([at(10, 20, 18), at(10, 60, 18)], 10, 1)

    expect(d.startsWith('M 10 2 L 10 20')).toBe(true)
    expect(d.endsWith('L 10 78')).toBe(true)
  })

  // Each end is measured against the height of the row it ends on.
  it('measures each end against the row it ends on', () => {
    const d = trailPath([at(10, 20, 18), at(10, 60, 8)], 10, 1)

    expect(d.startsWith('M 10 2')).toBe(true)
    expect(d.endsWith('L 10 68')).toBe(true)
  })
})

const ROUTES: NavGroup[] = [
  {
    items: [
      { to: '/', label: 'Home', exact: true },
      { to: '/files', label: 'Files' },
      { to: '/files/shared', label: 'Shared' },
      { to: '/console', label: 'Console', newTab: true },
    ],
  },
]

describe('activeRow', () => {
  const rows = flattenNav(ROUTES)

  it('matches an exact row only on its own path', () => {
    expect(rows[activeRow(rows, '/')]!.label).toBe('Home')
    expect(rows[activeRow(rows, '/files')]!.label).not.toBe('Home')
  })

  it('keeps a parent lit on a child route', () => {
    expect(rows[activeRow(rows, '/files/3')]!.label).toBe('Files')
  })

  it('prefers the longest match', () => {
    expect(rows[activeRow(rows, '/files/shared/x')]!.label).toBe('Shared')
  })

  // /filesystem is not inside /files.
  it('matches on a segment boundary, not on the string', () => {
    expect(activeRow(rows, '/filesystem')).toBe(-1)
  })

  it('never lights a new-tab row, which is not a page you are on', () => {
    expect(activeRow(rows, '/console')).toBe(-1)
  })

  it('reports nothing rather than guessing when no row matches', () => {
    expect(activeRow(rows, '/nowhere')).toBe(-1)
  })
})

// Anchors on one page share a path, so matching uses the hash.
const ANCHORS: NavGroup[] = [
  {
    items: [
      {
        to: '/theme',
        label: 'Theme',
        children: [
          { to: '/theme#spacing', label: 'Spacing' },
          { to: '/theme#motion', label: 'Motion' },
        ],
      },
    ],
  },
]

describe('activeRow, on a page of anchors', () => {
  const rows = flattenNav(ANCHORS)

  it('lights the anchor the hash names, over the page holding it', () => {
    expect(rows[activeRow(rows, '/theme', '/theme#motion')]!.label).toBe('Motion')
  })

  it('lights the page itself when no hash is on the location', () => {
    expect(rows[activeRow(rows, '/theme', '/theme')]!.label).toBe('Theme')
  })

  it('lights no anchor for a hash none of them names', () => {
    expect(rows[activeRow(rows, '/theme', '/theme#nowhere')]!.label).toBe('Theme')
  })
})

const router = createRouter({
  history: createMemoryHistory(),
  routes: [{ path: '/:rest(.*)', component: { template: '<div />' } }],
})

/** The components inComponent mounted, unmounted after each test. */
const mounted: { unmount: () => void }[] = []

/** Runs the composable inside a mounted component, as a real call site is. */
function inComponent<T>(fn: () => T): T {
  let out!: T
  mounted.push(mount(
    defineComponent({
      setup() {
        out = fn()
        return () => h('div')
      },
    }),
    { global: { plugins: [router] } },
  ))
  return out
}

describe('useNavTrail', () => {
  // A mounted scroll spy keeps looking for its region for two seconds, past the
  // test environment's teardown.
  afterEach(() => {
    for (const wrapper of mounted.splice(0)) wrapper.unmount()
    resetMotion()
  })

  // TrailPoint has only x and y; the node's `half` is dropped.
  const at = (node: { x: number, y: number } | undefined) => ({ x: node?.x, y: node?.y })

  // happy-dom has no getTotalLength or getPointAtLength, like a renderer the fallback covers.
  it('puts the disc on the active node when the path cannot be measured', async () => {
    const trail = inComponent(() => useNavTrail(() => NESTED, ref<number | undefined>(2)))

    await nextTick()

    expect(at(trail.dot.value)).toEqual(at(trail.nodes.value[2]))
  })

  // With no current row the disc keeps its last position, so the next move starts there.
  it('holds its place when no row is current', async () => {
    const active = ref<number | undefined>(4)
    const trail = inComponent(() => useNavTrail(() => NESTED, active))
    await nextTick()

    const held = { ...trail.dot.value }
    const length = trail.travelled.value
    expect(held.y).toBeGreaterThan(0)

    active.value = -1
    await nextTick()

    expect(at(trail.dot.value)).toEqual(at(held))
    expect(trail.travelled.value).toBe(length)
  })

  it('snaps rather than springs with motion off', async () => {
    configureMotion({ level: 'off' })
    const active = ref<number | undefined>(1)
    const trail = inComponent(() => useNavTrail(() => NESTED, active))

    await nextTick()
    active.value = 4
    await nextTick()

    expect(at(trail.dot.value)).toEqual(at(trail.nodes.value[4]))
  })

  it('snaps for a reader asking for reduced motion - a disc on a rail is movement', async () => {
    configureMotion({ level: 'reduced' })
    const active = ref<number | undefined>(1)
    const trail = inComponent(() => useNavTrail(() => NESTED, active))

    await nextTick()
    active.value = 4
    await nextTick()

    expect(at(trail.dot.value)).toEqual(at(trail.nodes.value[4]))
  })

  it('sizes the box from the rows it holds and the deepest branch', async () => {
    const trail = inComponent(() => useNavTrail(() => NESTED, ref<number | undefined>()))
    await nextTick()

    const m = trail.metrics.value
    // The leading heading keeps only its clearance below; the unlabelled group takes none.
    expect(trail.height.value).toBe(m.head + 5 * m.row + 5 * m.rowGap + m.groupBelow)
    expect(trail.width.value).toBeGreaterThan(m.x + m.indent)
  })

  // The box grows and offsets by the rail's reach, so reach costs the drawer no height.
  it('grows its box for the reach rather than the list', async () => {
    const trail = inComponent(() => useNavTrail(() => NESTED, ref<number | undefined>()))
    await nextTick()

    // The default reach stops on the centres, so the box matches the list.
    expect(trail.box.value.top).toBe(0)
    expect(trail.box.value.height).toBe(trail.height.value)
  })

  // The SVG is out of flow, so the drawer is as tall as its rows whatever the reach.
  it('never charges the list for what the rail reaches', async () => {
    const trail = inComponent(() => useNavTrail(() => NESTED, ref<number | undefined>()))
    await nextTick()

    expect(trail.height.value).toBe(trailHeight(trail.rows.value, trail.metrics.value))
  })

  // The rail starts at the first destination, not above a leading heading.
  it('draws the rail between destinations, not past a leading heading', async () => {
    const trail = inComponent(() => useNavTrail(() => NESTED, ref<number | undefined>()))
    await nextTick()

    const rows = trail.rows.value
    const nodes = trail.nodes.value
    const first = nodes[rows.findIndex(row => row.kind === 'link')]!

    expect(rows[0]!.kind).toBe('head')

    // Its own column, starting no higher than its row's top edge.
    const [, x, y] = trail.path.value.split(' ')
    expect(Number(x)).toBe(first.x)
    expect(Number(y)).toBe(first.y)
    expect(Number(y)).toBeGreaterThan(nodes[0]!.y)
  })

  // Per-row offsets, so a flat entry is not pushed out to the deepest branch's column.
  it('starts each row just past its own segment of the rail', async () => {
    const trail = inComponent(() => useNavTrail(() => NESTED, ref<number | undefined>()))
    await nextTick()

    const m = trail.metrics.value
    const [, parent, child] = trail.insets.value

    expect(parent).toBe(m.x + trail.dotSize.value / 2 + 8)
    expect(child! - parent!).toBe(m.indent)
  })

  // Every row clears its own disc.
  it('never puts a row closer to the rail than the disc is wide', async () => {
    const trail = inComponent(() => useNavTrail(() => NESTED, ref<number | undefined>()))
    await nextTick()

    for (const [i, inset] of trail.insets.value.entries()) {
      expect(inset).toBeGreaterThan(trail.nodes.value[i]!.x + trail.dotSize.value / 2)
    }
  })

  it('falls back to the route when no model is bound', async () => {
    await router.push('/textures/paper')
    const trail = inComponent(() => useNavTrail(() => NESTED, ref<number | undefined>()))

    await nextTick()
    expect(trail.rows.value[trail.index.value]!.label).toBe('Paper')
  })
})
