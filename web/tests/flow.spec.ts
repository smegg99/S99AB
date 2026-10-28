// web/tests/flow.spec.ts

import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { createVuetify } from 'vuetify'
import { mount } from '@vue/test-utils'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import AppShell from '../src/components/shell/AppShell.vue'
import Flow from '../src/components/shell/Flow.vue'
import { acquireSlot, applyGround, configureGround, groundConfig, groundShape, flowStops, liveInstances, loadNeat, releaseSlot } from '../src/composables/appearance/internal/flow'

beforeEach(() => {
  while (liveInstances() > 0) releaseSlot()
  configureGround({
    kind: 'flow',
    maxInstances: 3,
    resolution: 0.8,
    loader: undefined,
    colors: [],
    speed: 3,
    waveAmplitude: 4,
    wireframe: false,
    dark: { shadows: 6, highlights: 1, colorBrightness: 0.8, colorSaturation: 2 },
  })
})

describe('flow slots', () => {
  // Browsers kill the oldest WebGL context past a cap, so excess surfaces get
  // refused and fall back to the CSS still.
  it('hands out no more than the cap', () => {
    expect(acquireSlot(false)).toBe(true)
    expect(acquireSlot(false)).toBe(true)
    expect(acquireSlot(false)).toBe(true)
    expect(acquireSlot(false)).toBe(false)
    expect(liveInstances()).toBe(3)
  })

  it('gives one back', () => {
    acquireSlot(false)
    releaseSlot()

    expect(liveInstances()).toBe(0)
  })

  // The ground is always on screen, so it is admitted over the cap without evicting anything.
  it('always admits the ground', () => {
    configureGround({ maxInstances: 1 })

    expect(acquireSlot(false)).toBe(true)
    expect(acquireSlot(false)).toBe(false)
    expect(acquireSlot(true)).toBe(true)
  })

  // Double unmounts or unmounts after a refusal must not let the count go negative.
  it('never drops below zero', () => {
    releaseSlot()
    releaseSlot()

    expect(liveInstances()).toBe(0)
  })

  it('patches config without dropping the rest', () => {
    configureGround({ speed: 6 })

    expect(groundConfig().speed).toBe(6)
    expect(groundConfig().maxInstances).toBe(3)
  })
})

describe('loading the library', () => {
  // The app supplies the import; the layer must not contain the specifier, since
  // a bare or computed specifier either becomes a build dependency or fails at runtime.
  it('names no module specifier of its own', () => {
    const source = readFileSync(
      resolve(process.cwd(), 'src/composables/appearance/internal/flow.ts'),
      'utf8',
    )

    // Comments and strings are stripped first; the docs and the warning legitimately name it.
    const code = source
      .replace(/\/\*[\s\S]*?\*\//g, '')
      .replace(/^\s*\/\/.*$/gm, '')
      .replace(/'(?:[^'\\]|\\.)*'|"(?:[^"\\]|\\.)*"|`(?:[^`\\]|\\.)*`/g, '\'\'')

    expect(code).not.toMatch(/import\s*\(/)
  })

  it('answers null and says so when no loader was supplied', async () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})
    configureGround({ loader: undefined })

    expect(await loadNeat()).toBeNull()
    expect(warn).toHaveBeenCalledOnce()
    expect(warn.mock.calls[0]![0]).toContain('s99ab.ground.loader')

    warn.mockRestore()
  })

  it('answers null when the app\'s loader throws', async () => {
    configureGround({ loader: () => Promise.reject(new Error('not installed')) })

    expect(await loadNeat()).toBeNull()
  })
})

describe('the shader shape', () => {
  // Every option is a @firecms/neat option under its own name, so gradients paste into app config.
  it('is entirely configurable', () => {
    configureGround({ waveAmplitude: 9, speed: 1, wireframe: true })

    const shape = groundShape(false)
    expect(shape.waveAmplitude).toBe(9)
    expect(shape.speed).toBe(1)
    expect(shape.wireframe).toBe(true)
  })

  // Dark overrides merge over the base.
  it('applies the dark overrides over the base rather than instead of it', () => {
    configureGround({ waveAmplitude: 9, dark: { shadows: 2 } })

    const dark = groundShape(true)
    expect(dark.shadows).toBe(2)
    // Not in the dark map, so it comes from the base.
    expect(dark.waveAmplitude).toBe(9)
  })

  it('patches one dark override without dropping the rest', () => {
    configureGround({ dark: { shadows: 2 } })

    expect(groundShape(true).colorBrightness).toBe(0.8)
  })

  // Only shader options are passed through.
  it('carries none of the layer\'s own bookkeeping', () => {
    const shape = groundShape(false) as unknown as Record<string, unknown>

    for (const key of ['kind', 'maxInstances', 'licenseKey', 'colors', 'dark', 'loader']) {
      expect(shape[key], `${key} leaked into the shader options`).toBeUndefined()
    }
  })
})

describe('flow stops', () => {
  // Configured stops win over the theme.
  it('prefers configured colours over the theme', () => {
    configureGround({ colors: ['#000000', '#111111'] })

    expect(flowStops({ bg: '#edf0f5', accent: '#2358d6' }, false))
      .toEqual(['#000000', '#111111'])

    configureGround({ colors: [] })
  })

  // Built from theme tokens, so the gradient follows the variant and accent.
  it('builds five stops from the palette', () => {
    const stops = flowStops(
      { bg: '#111317', accent: '#6d9bf8', warning: '#e0ad4f', sunk: '#15171b' },
      true,
    )

    expect(stops).toHaveLength(5)
    expect(stops[0]).toBe('#111317')
    expect(stops.every(stop => /^#[0-9a-f]{6}$/i.test(stop))).toBe(true)
  })

  // A missing token still yields five usable colours.
  it('falls back to the ground for a token the palette lacks', () => {
    const stops = flowStops({ bg: '#edf0f5' }, false)

    expect(stops).toHaveLength(5)
    expect(stops.every(stop => stop === '#edf0f5')).toBe(true)
  })

  it('has a ground even with no palette at all', () => {
    expect(flowStops({}, true)[0]).toBe('#111317')
    expect(flowStops({}, false)[0]).toBe('#edf0f5')
  })
})

describe('UiAppShell renders the ground', () => {
  const vuetify = createVuetify()

  function shell(props: Record<string, unknown> = {}) {
    return mount(AppShell, { props, global: { plugins: [vuetify], stubs: { teleport: true } } })
  }

  // Vue casts an absent Boolean prop to false, so the prop must not shadow the
  // config default.
  it('renders it when configured on and nothing was passed', () => {
    configureGround({ kind: 'flow' })

    expect(shell().findComponent({ name: 'Flow' }).exists()).toBe(true)
  })

  it('does not render it when the app configured it off', () => {
    configureGround({ kind: 'none' })

    expect(shell().findComponent({ name: 'Flow' }).exists()).toBe(false)
  })

  it('lets one shell veto it', () => {
    configureGround({ kind: 'flow' })

    expect(shell({ noFlow: true }).findComponent({ name: 'Flow' }).exists()).toBe(false)
  })

  // `wash` draws the washes without the shader.
  it('draws the washes without the shader at wash', () => {
    configureGround({ kind: 'wash' })
    const w = shell()

    expect(w.findComponent({ name: 'Flow' }).exists()).toBe(false)
    expect(w.findComponent({ name: 'Backdrop' }).exists()).toBe(true)
  })

  it('draws neither at none', () => {
    configureGround({ kind: 'none' })
    const w = shell()

    expect(w.findComponent({ name: 'Flow' }).exists()).toBe(false)
    expect(w.findComponent({ name: 'Backdrop' }).exists()).toBe(false)
  })

  // The stylesheet reads the kind from the document.
  it('puts the kind on the document', () => {
    for (const kind of ['flow', 'wash', 'none'] as const) {
      configureGround({ kind })
      applyGround()
      expect(document.documentElement.getAttribute('data-ground')).toBe(kind)
    }
  })
})

describe('UiFlow', () => {
  const vuetify = createVuetify()

  function render(props: Record<string, unknown> = {}) {
    return mount(Flow, { props, global: { plugins: [vuetify] } })
  }

  // happy-dom has no WebGL, so this is the fallback path (software-rendered
  // webviews, no optional peer installed).
  it('renders a canvas and takes no slot without WebGL', () => {
    const wrapper = render()

    expect(wrapper.find('canvas').exists()).toBe(true)
    expect(liveInstances()).toBe(0)
  })

  it('marks itself decorative', () => {
    expect(render().attributes('aria-hidden')).toBe('true')
  })

  it('fills the viewport as the ground and its container otherwise', () => {
    expect(render({ ground: true }).classes()).toContain('flow--ground')
    expect(render().classes()).not.toContain('flow--ground')
  })

  // Transparent until the shader draws, so a failed build shows the backdrop.
  it('stays transparent until it is running', () => {
    expect(render().find('canvas').classes()).not.toContain('flow__canvas--ready')
  })

  // Unmounting returns the slot even when none was taken.
  it('leaves the registry where it found it', () => {
    const wrapper = render()
    wrapper.unmount()

    expect(liveInstances()).toBe(0)
  })
})
