// web/tests/appearance.spec.ts

import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { defineComponent, h, nextTick } from 'vue'
import { mount } from '@vue/test-utils'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { createVuetify, useTheme } from 'vuetify'
import * as components from 'vuetify/components'
import * as directives from 'vuetify/directives'
import ContrastToggle from '../src/components/shell/ContrastToggle.vue'
import ThemeToggle from '../src/components/shell/ThemeToggle.vue'
import { useAppearance } from '../src/composables/appearance/useAppearance'
import { DEFAULTS, palette, s99abTheme } from '../src/theme'
import { fakeI18n } from './fake-i18n'

function fresh() {
  const { theme, defaults } = s99abTheme()
  return createVuetify({ components, directives, theme, defaults })
}

function inComponent<T>(fn: () => T, vuetify: ReturnType<typeof fresh>): T {
  let out!: T
  mount(
    defineComponent({
      setup() {
        out = fn()
        return () => h('div')
      },
    }),
    { global: { plugins: [vuetify] } },
  )
  return out
}

/** Sets what the OS asks for; the starting appearance comes from here. */
function prefer({ dark = false, contrast = false } = {}) {
  vi.stubGlobal('matchMedia', (query: string) => ({
    matches: query.includes('dark') ? dark : query.includes('contrast') ? contrast : false,
    media: query,
    addEventListener() {},
    removeEventListener() {},
  }))
}

beforeEach(() => {
  localStorage.clear()
  prefer()
})

afterEach(() => {
  vi.unstubAllGlobals()
  localStorage.clear()
  // fresh() resets the theme module; this resets the document attribute.
  document.documentElement.removeAttribute('data-contrast')
})

// High contrast repaints the two registered themes: Vuetify computes colours in
// JS from the active theme, so a CSS override would not reach them.
describe('s99abTheme', () => {
  // Read through useTheme: what an app can switch to is what Vuetify registered.
  it('registers two themes and no high-contrast twins', () => {
    const api = inComponent(() => useTheme(), fresh())

    expect(Object.keys(api.themes.value).sort()).toEqual(['dark', 'light'])
  })

  // Pure ink on a pure ground, wider than the normal palette.
  it('widens the ink against the ground', () => {
    const normal = palette({ dark: true })
    const high = palette({ dark: true, high: true })

    expect(normal.ink).not.toBe('#ffffff')
    expect(high.ink).toBe('#ffffff')
    expect(high.bg).toBe('#000000')
  })

  // An app-supplied accent is used as given.
  it('restates its own accent for the mode but never the app\'s', () => {
    expect(palette({ dark: true, high: true }).accent)
      .not.toBe(palette({ dark: true }).accent)
    expect(palette({ dark: true, high: true, accent: '#ff0000' }).accent).toBe('#ff0000')
  })

  // The toggle end to end: same theme name, painted from the widened table.
  it('repaints the active theme in place when contrast goes on', async () => {
    prefer({ dark: true })
    const api = inComponent(() => ({ a: useAppearance(), theme: useTheme() }), fresh())
    await nextTick()

    const before = api.theme.global.current.value.colors.background

    api.a.toggleContrast()
    await nextTick()

    expect(api.theme.global.name.value).toBe('dark')
    expect(api.theme.global.current.value.colors.background).not.toBe(before)
    expect(api.theme.global.current.value.colors.background).toBe('#000000')
  })

  // The attribute _textures.scss reads to turn textures off.
  it('marks the document so the stylesheet can follow', async () => {
    const api = inComponent(() => useAppearance(), fresh())
    await nextTick()
    expect(document.documentElement.hasAttribute('data-contrast')).toBe(false)

    api.toggleContrast()
    await nextTick()
    expect(document.documentElement.getAttribute('data-contrast')).toBe('high')

    api.toggleContrast()
    await nextTick()
    expect(document.documentElement.hasAttribute('data-contrast')).toBe(false)
  })
})

describe('matching the system', () => {
  // With nothing stored, the app opens in the OS's light or dark.
  it.each([[true, 'dark'], [false, 'light']])(
    'opens on what the OS asks for when nothing is stored: dark=%s',
    async (dark, expected) => {
      prefer({ dark })
      const api = inComponent(() => {
        useAppearance()
        return useTheme()
      }, fresh())
      await nextTick()

      expect(api.global.name.value).toBe(expected)
    },
  )

  it('takes the contrast preference at the same time', async () => {
    prefer({ dark: true, contrast: true })
    const api = inComponent(() => ({ a: useAppearance(), theme: useTheme() }), fresh())
    await nextTick()

    expect(api.theme.global.name.value).toBe('dark')
    expect(api.a.high.value).toBe(true)
  })

  // A stored choice beats the OS.
  it('lets a stored choice beat the OS', async () => {
    localStorage.setItem('s99ab.theme', 'light')
    prefer({ dark: true })

    const api = inComponent(() => {
      useAppearance()
      return useTheme()
    }, fresh())
    await nextTick()

    expect(api.global.name.value).toBe('light')
  })

  // Follows a later OS change on an axis the user has not set.
  it('follows a later change on an axis nobody has spoken for', async () => {
    const listeners: Array<() => void> = []
    let dark = false

    vi.stubGlobal('matchMedia', (query: string) => ({
      get matches() {
        return query.includes('dark') ? dark : false
      },
      media: query,
      addEventListener: (_: string, fn: () => void) => listeners.push(fn),
      removeEventListener() {},
    }))

    const api = inComponent(() => useAppearance(), fresh())
    await nextTick()
    expect(api.dark.value).toBe(false)

    dark = true
    listeners.forEach(fn => fn())
    await nextTick()

    expect(api.dark.value).toBe(true)
  })

  it('stops following once the reader has chosen', async () => {
    const listeners: Array<() => void> = []
    let dark = true

    vi.stubGlobal('matchMedia', (query: string) => ({
      get matches() {
        return query.includes('dark') ? dark : false
      },
      media: query,
      addEventListener: (_: string, fn: () => void) => listeners.push(fn),
      removeEventListener() {},
    }))

    const api = inComponent(() => useAppearance(), fresh())
    await nextTick()

    api.toggleTheme()
    await nextTick()
    expect(api.dark.value).toBe(false)

    // The OS says dark again; the stored choice still wins.
    dark = false
    listeners.forEach(fn => fn())
    dark = true
    listeners.forEach(fn => fn())
    await nextTick()

    expect(api.dark.value).toBe(false)
  })
})

describe('useAppearance', () => {
  it('moves each axis without touching the other', async () => {
    prefer({ dark: true })
    const vuetify = fresh()
    const api = inComponent(() => ({ a: useAppearance(), theme: useTheme() }), vuetify)
    await nextTick()

    api.a.toggleContrast()
    await nextTick()
    expect(api.theme.global.name.value).toBe('dark')
    expect(api.a.high.value).toBe(true)

    api.a.toggleTheme()
    await nextTick()
    expect(api.theme.global.name.value).toBe('light')
    expect(api.a.high.value).toBe(true)
  })

  // Flipping one axis keeps the other.
  it('keeps contrast when the theme flips, and the reverse', async () => {
    prefer({ dark: true })
    const vuetify = fresh()
    const api = inComponent(() => ({ a: useAppearance(), theme: useTheme() }), vuetify)

    api.a.toggleContrast()
    api.a.toggleTheme()
    api.a.toggleTheme()
    await nextTick()

    expect(api.theme.global.name.value).toBe('dark')
    expect(api.a.high.value).toBe(true)
  })

  it('remembers both under one namespace', async () => {
    prefer({ dark: true })
    const vuetify = fresh()
    const api = inComponent(() => useAppearance(() => ({ theme: 'app.theme' })), vuetify)

    api.toggleTheme()
    api.toggleContrast()
    await nextTick()

    expect(localStorage.getItem('app.theme')).toBe('light')
    expect(localStorage.getItem('app.theme.contrast')).toBe('high')
  })

  it('restores what was stored, both axes in one paint', async () => {
    localStorage.setItem('app.theme', 'light')
    localStorage.setItem('app.theme.contrast', 'high')

    const vuetify = fresh()
    const api = inComponent(() => ({
      a: useAppearance(() => ({ theme: 'app.theme' })),
      theme: useTheme(),
    }), vuetify)
    await nextTick()

    expect(api.theme.global.name.value).toBe('light')
    expect(api.a.high.value).toBe(true)
  })

  // Contrast starts from the OS setting; light/dark starts from defaultTheme.
  it('starts from the OS contrast setting when nothing is stored', async () => {
    vi.stubGlobal('matchMedia', (query: string) => ({
      matches: query.includes('prefers-contrast'),
      media: query,
      addEventListener() {},
      removeEventListener() {},
    }))

    const vuetify = fresh()
    const api = inComponent(() => useAppearance(), vuetify)
    await nextTick()

    expect(api.high.value).toBe(true)
  })

  // A stored preference overrides the OS.
  it('lets a stored preference override the OS', async () => {
    vi.stubGlobal('matchMedia', (query: string) => ({
      matches: query.includes('prefers-contrast'),
      media: query,
      addEventListener() {},
      removeEventListener() {},
    }))
    localStorage.setItem('s99ab.theme.contrast', 'normal')

    const vuetify = fresh()
    const api = inComponent(() => useAppearance(), vuetify)
    await nextTick()

    expect(api.high.value).toBe(false)
  })
})

describe('the two toggles', () => {
  const mountBoth = (vuetify: ReturnType<typeof fresh>) =>
    mount(
      defineComponent({
        components: { ThemeToggle, ContrastToggle },
        template: '<div><ThemeToggle /><ContrastToggle /></div>',
      }),
      { global: { plugins: [vuetify, fakeI18n(k => k)] } },
    )

  // Two mounted toggles read one active theme name, so neither goes stale.
  it('agree on the state after either is pressed', async () => {
    prefer({ dark: true })
    const vuetify = fresh()
    const w = mountBoth(vuetify)
    const contrast = w.findComponent(ContrastToggle).find('button')

    await contrast.trigger('click')

    // Contrast went on and the theme button still reads dark.
    expect(contrast.attributes('aria-pressed')).toBe('true')
    expect(w.findComponent(ThemeToggle).html()).toContain('mdi-weather-night')
  })

  it('carries the state on the button rather than in its name', async () => {
    const vuetify = fresh()
    const w = mountBoth(vuetify)
    const button = w.findComponent(ContrastToggle).find('button')

    expect(button.attributes('aria-pressed')).toBe('false')
    await button.trigger('click')
    expect(button.attributes('aria-pressed')).toBe('true')
  })
})

// --------------------------------------------------------------- shapes ----

// The layer's control shape rules, in the createVuetify defaults and in the stylesheets.
describe('control shapes', () => {
  const styles = resolve(process.cwd(), 'src/styles')
  const read = (name: string) => readFileSync(resolve(styles, name), 'utf8')

  it('leaves a chip a pill', () => {
    expect(DEFAULTS?.VChip).not.toHaveProperty('label')

    // The corner rule in _surfaces.scss must also leave .v-chip alone.
    const corners = read('_surfaces.scss')
    const shared = corners.match(/:where\(\s*\.v-card,([\s\S]*?)\)\s*\{/)?.[1]

    expect(shared).not.toContain('.v-chip')
    expect(corners).toMatch(/:where\(\.v-chip\)\s*\{[^}]*var\(--s99ab-chip-radius\)/)
  })

  // Every button is the row height, anywhere. Icon buttons are excluded because
  // _surfaces.scss sizes them from the same knob.
  it('levels every button but the icon one to the row height', () => {
    expect(read('_controls.scss')).toMatch(
      /\.v-btn:not\(\.v-tab\):not\(\.v-btn--icon\)\s*\{[^}]*height:\s*var\(--s99ab-control-h\)/,
    )
  })

  // Square through aspect-ratio at --s99ab-control-h, so a component that sets
  // its own height stays square.
  it('keeps an icon button square at whatever height it is given', () => {
    const rule = read('_surfaces.scss').match(
      /\.v-btn--icon:not\(\.v-tab\)\s*\{([^}]*)\}/,
    )?.[1]

    expect(rule).toContain('height: var(--s99ab-control-h)')
    expect(rule).toContain('aspect-ratio: 1')
    expect(rule).not.toContain('--v-btn-height')
  })

  // Anything sizing one states the height only.
  it('leaves the width to that ratio everywhere else', () => {
    for (const partial of ['_tables.scss', '_tiles.scss', '_controls.scss']) {
      const rules = read(partial).match(/\.v-btn--icon[^{]*\{[^}]*\}/g) ?? []
      for (const rule of rules) {
        expect(rule, `${partial} sizes an icon button's width`).not.toMatch(/\bwidth:/)
      }
    }
  })
})
