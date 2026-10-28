// web/tests/layout.spec.ts

import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { defineComponent, h, nextTick } from 'vue'
import { createRouter, createWebHistory } from 'vue-router'
import { mount } from '@vue/test-utils'
import { describe, expect, it } from 'vitest'
import AppShell from '../src/components/shell/AppShell.vue'
import Page from '../src/components/shell/Page.vue'
import Panel from '../src/components/primitives/Panel.vue'
import Stat from '../src/components/primitives/Stat.vue'
import ToolGroup from '../src/components/primitives/ToolGroup.vue'
import { vuetify, vuetifyWith } from './mount'

// Vuetify's display service samples window.innerWidth when the plugin is
// created, so the width is set first; a later resize flips `permanent` and force-opens the drawer.
function setViewport(width: number) {
  Object.defineProperty(window, 'innerWidth', {
    value: width,
    configurable: true,
  })
}

setViewport(1600)

setViewport(700)
const narrowVuetify = vuetifyWith({})

// AppShell's drawer renders v-list-item with `to`, which resolves a route.
const router = createRouter({
  history: createWebHistory(),
  routes: [
    { path: '/', component: { template: '<div />' } },
    { path: '/:rest(.*)', component: { template: '<div />' } },
  ],
})

function mountShell(props: Record<string, unknown> = {}, wide = true) {
  return mount(AppShell, {
    props,
    global: { plugins: [wide ? vuetify : narrowVuetify, router] },
  })
}

describe('UiPanel', () => {
  it('draws no head when there is nothing to put in one', () => {
    const wrapper = mount(Panel, { global: { plugins: [vuetify] } })
    expect(wrapper.find('.panel__head').exists()).toBe(false)
  })

  it('draws a head for a title alone', () => {
    const wrapper = mount(Panel, {
      props: { title: 'Runs' },
      global: { plugins: [vuetify] },
    })
    expect(wrapper.find('.panel__title').text()).toBe('Runs')
  })

  // A head holding only actions (a toolbar over a table) still renders.
  it('draws a head for actions with no title', () => {
    const wrapper = mount(Panel, {
      slots: { actions: () => h('button', 'Run') },
      global: { plugins: [vuetify] },
    })
    expect(wrapper.find('.panel__head').exists()).toBe(true)
    expect(wrapper.find('.panel__title').exists()).toBe(false)
  })

  it('drops the body padding when flush, so a table can pad itself', () => {
    const plain = mount(Panel, { global: { plugins: [vuetify] } })
    const flush = mount(Panel, {
      props: { flush: true },
      global: { plugins: [vuetify] },
    })

    expect(plain.find('.panel__body').classes()).not.toContain(
      'panel__body--flush',
    )
    expect(flush.find('.panel__body').classes()).toContain(
      'panel__body--flush',
    )
  })

  it('renders the subtitle above the slotted body', () => {
    const wrapper = mount(Panel, {
      props: { title: 'Jobs', subtitle: 'The schedule comes from config.' },
      slots: { default: () => h('p', 'body') },
      global: { plugins: [vuetify] },
    })
    expect(wrapper.find('.panel__lead').text()).toBe(
      'The schedule comes from config.',
    )
  })
})

describe('UiStat', () => {
  it('renders label, value and unit', () => {
    const wrapper = mount(Stat, {
      props: { label: 'Accepted', value: 42, unit: 'req' },
    })
    expect(wrapper.text()).toContain('Accepted')
    expect(wrapper.text()).toContain('42')
    expect(wrapper.text()).toContain('req')
  })

  it('lets a slot replace the value, for something that is not a number', () => {
    const wrapper = mount(Stat, {
      props: { label: 'Identity' },
      slots: { default: () => h('code', 'a1b2') },
    })
    expect(wrapper.find('code').text()).toBe('a1b2')
  })
})

describe('UiToolGroup', () => {
  const items = [
    { value: 'full', label: 'full' },
    { value: 'off', label: 'off' },
  ]

  it('marks exactly one key as pressed', () => {
    const wrapper = mount(ToolGroup, {
      props: { items, modelValue: 'off' },
      global: { plugins: [vuetify] },
    })
    const pressed = wrapper.findAll('.key--active')

    expect(pressed).toHaveLength(1)
    expect(pressed[0]!.text()).toBe('off')
  })

  it('emits the value of the key that was pressed', async () => {
    const wrapper = mount(ToolGroup, {
      props: { items, modelValue: 'full' },
      global: { plugins: [vuetify] },
    })
    await wrapper.findAll('button')[1]!.trigger('click')

    expect(wrapper.emitted('update:modelValue')).toEqual([['off']])
  })

  it('carries aria-pressed, so a screen reader hears a toggle not a button', () => {
    const wrapper = mount(ToolGroup, {
      props: { items, modelValue: 'full' },
      global: { plugins: [vuetify] },
    })
    const [first, second] = wrapper.findAll('button')

    expect(first!.attributes('aria-pressed')).toBe('true')
    expect(second!.attributes('aria-pressed')).toBe('false')
  })
})

describe('UiAppShell', () => {
  const groups = [
    { items: [{ to: '/', label: 'Overview' }] },
    {
      label: 'Backend',
      items: [
        { to: '/jobs', label: 'Jobs' },
        { to: '/files', label: 'Files' },
      ],
    },
  ]

  it('renders no drawer and no nav toggle when there are no links', () => {
    const wrapper = mountShell()

    expect(wrapper.find('.v-navigation-drawer').exists()).toBe(false)
    expect(wrapper.find('.bar__burger').exists()).toBe(false)
  })

  it('renders every link, under its group heading', () => {
    const wrapper = mountShell({ groups })

    expect(wrapper.findAll('.nav__list .v-list-item')).toHaveLength(3)
    expect(wrapper.find('.nav__group').text()).toBe('Backend')
  })

  // With both `to` and `href` Vuetify routes and no new tab opens, so a new-tab link drops `to`.
  it('renders a newTab link as a plain link that leaves the page', () => {
    const wrapper = mountShell({
      groups: [{ items: [{ to: '/console', label: 'Console', newTab: true }] }],
    })

    const row = wrapper.find('.nav__list .v-list-item')

    expect(row.attributes('href')).toBe('/console')
    expect(row.attributes('target')).toBe('_blank')
    expect(row.attributes('rel')).toBe('noopener')
    expect(row.classes()).not.toContain('v-list-item--active')
    expect(row.find('.nav__away').exists()).toBe(true)
  })

  it('leaves an ordinary link a route', () => {
    const wrapper = mountShell({ groups })
    const row = wrapper.find('.nav__list .v-list-item')

    expect(row.attributes('target')).toBeUndefined()
    expect(row.find('.nav__away').exists()).toBe(false)
  })

  // Both nav variants take the same array; the plain list indents, the rail bends.
  it('indents a nested link rather than flattening it away', () => {
    const wrapper = mountShell({
      groups: [{
        items: [{
          to: '/files',
          label: 'Files',
          children: [{ to: '/files/shared', label: 'Shared' }],
        }],
      }],
    })

    const rows = wrapper.findAll('.nav__list .v-list-item')

    expect(rows).toHaveLength(2)
    expect(rows[1]!.attributes('style')).toContain('--nav-depth: 1')
  })

  it('draws the plain list by default', () => {
    expect(mountShell({ groups }).find('.trail').exists()).toBe(false)
  })

  it('draws the rail when the shell asks for one', () => {
    const wrapper = mountShell({ groups, navVariant: 'trail' })

    expect(wrapper.find('.trail').exists()).toBe(true)
    expect(wrapper.findAll('.trail__row')).toHaveLength(3)
    expect(wrapper.find('.trail__head').text()).toBe('Backend')
  })

  it('says on the box what the current row is lit by', () => {
    for (const lit of ['both', 'accent', 'face', 'plain'] as const) {
      const wrapper = mountShell({ groups, navVariant: 'trail', navLit: lit })

      expect(wrapper.find('.trail').classes()).toContain(`trail--lit-${lit}`)
      expect(wrapper.findAll('.trail__row')).toHaveLength(3)
    }
  })

  // The row takes the disc's colour unless the app asks for a quieter one.
  it('ties the row to the rail by default', () => {
    expect(mountShell({ groups, navVariant: 'trail' }).find('.trail').classes())
      .toContain('trail--lit-both')
  })

  // Each row starts past its own rail segment, so no face is drawn under the line.
  it('starts every row past the rail rather than under it', () => {
    const wrapper = mountShell({ groups, navVariant: 'trail' })

    for (const row of wrapper.findAll('.trail__row')) {
      expect(row.attributes('style')).toContain('--trail-inset')
    }
  })

  // With no current page the disc is faded, not removed, so it keeps its position for the next move.
  it('shows no disc where no row matches the route', () => {
    const wrapper = mountShell({
      groups: [{ items: [{ to: '/console', label: 'Console', newTab: true }] }],
      navVariant: 'trail',
    })

    expect(wrapper.find('.trail__disc').attributes('style')).toContain('opacity: 0')
  })

  // See useShellDrawer for the mechanism.
  it('opens the pinned drawer, rather than reserving space for a hidden one', async () => {
    const wrapper = mountShell({ groups })
    await nextTick()

    expect(wrapper.find('.v-navigation-drawer').classes()).toContain(
      'v-navigation-drawer--active',
    )
    expect(wrapper.find('.bar__burger').exists()).toBe(false)
  })

  // Below the breakpoint the drawer is an overlay and the bar shows its toggle.
  it('closes the drawer and shows the toggle on a narrow window', async () => {
    const wrapper = mountShell({ groups }, false)
    await nextTick()

    expect(wrapper.find('.v-navigation-drawer').classes()).not.toContain(
      'v-navigation-drawer--active',
    )
    expect(wrapper.find('.bar__burger').exists()).toBe(true)
  })

  it('puts the page inside a container, so every screen shares one width', () => {
    const wrapper = mountShell({ groups })
    expect(wrapper.find('.v-container.shell__page').exists()).toBe(true)
  })

  // Off by default: a deferred panel is not laid out, so measurements inside it see the placeholder.
  it('lays every panel out until a screen says it is long enough not to', () => {
    expect(mountShell().find('.shell__page').classes()).not.toContain('shell__page--defer')
    expect(
      mountShell({ defer: true }).find('.shell__page').classes(),
    ).toContain('shell__page--defer')
  })

  it('stacks the page by default and stops when asked not to', () => {
    expect(mountShell().find('.shell__page').classes()).toContain(
      'shell__page--stack',
    )
    expect(
      mountShell({ stack: false }).find('.shell__page').classes(),
    ).not.toContain('shell__page--stack')
  })

  it('drops the backdrop when a screen supplies its own ground', () => {
    expect(mountShell().find('.s99ab-backdrop').exists()).toBe(true)
    expect(
      mountShell({ backdrop: false }).find('.s99ab-backdrop').exists(),
    ).toBe(false)
  })

  it('renders the page content it is given', () => {
    const wrapper = mount(
      defineComponent({
        setup: () => () =>
          h(AppShell, { title: 'Demo' }, { default: () => h('p', 'the page') }),
      }),
      { global: { plugins: [vuetify, router] } },
    )

    expect(wrapper.find('.shell__page').text()).toBe('the page')
  })
})

// Vue cannot animate a fragment, so a page with several root elements makes the
// page transition skip with a warning. UiPage gives it one root.
describe('UiPage', () => {
  it('is one element however many children a page emits', () => {
    const wrapper = mount(Page, {
      slots: { default: '<h1>Title</h1><section>One</section><section>Two</section>' },
    })

    expect(wrapper.element.nodeType).toBe(1)
    expect(wrapper.element.children).toHaveLength(3)
  })

  // The gap moves onto this element, since the shell's container now has one child.
  it('carries the page rhythm, and gives it up when asked', () => {
    expect(mount(Page).classes()).toContain('s99ab-page--stack')
    expect(mount(Page, { props: { stack: false } }).classes())
      .not.toContain('s99ab-page--stack')
  })
})

// Text drawn directly on the ground, which an app can make arbitrarily busy, takes full-strength ink.
describe('ground text', () => {
  const type = readFileSync(resolve(process.cwd(), 'src/styles/_type.scss'), 'utf8')
  const header = readFileSync(
    resolve(process.cwd(), 'src/components/primitives/PageHeader.vue'),
    'utf8',
  )

  it('takes the full-strength ink', () => {
    const rule = type.match(/\.s99ab-on-ground[\s\S]*?\n\}/)

    expect(rule, '.s99ab-on-ground is gone or was renamed').not.toBeNull()
    expect(rule![0]).toContain('color: rgb(var(--v-theme-ink));')
  })

  // Ink only, no text shadow; the ground is attenuated instead (see $flow-opacity).
  it('carries no shadow', () => {
    const rule = type.match(/\.s99ab-on-ground[\s\S]*?\n\}/)![0]

    expect(rule).not.toContain('text-shadow')
  })

  it('reaches the eyebrow, which sets a quieter ink of its own', () => {
    expect(type).toContain('.s99ab-on-ground .s99ab-eyebrow')
  })

  it('is worn by the page header, the layer\'s only text on the ground', () => {
    expect(header).toContain('s99ab-on-ground')
  })

  // The lead must not set its own ink, which would beat the class above.
  it('leaves the lead\'s colour to be inherited', () => {
    const lead = header.match(/\.ph__lead \{[\s\S]*?\n\}/)![0]

    expect(lead).not.toContain('color:')
  })
})
