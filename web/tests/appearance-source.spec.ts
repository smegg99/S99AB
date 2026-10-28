// web/tests/appearance-source.spec.ts

import { defineComponent, h, nextTick } from 'vue'
import { createVuetify, useTheme } from 'vuetify'
import * as components from 'vuetify/components'
import * as directives from 'vuetify/directives'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { mount } from '@vue/test-utils'
import { useAppearance } from '../src/composables/appearance/useAppearance'
import { registerAppearanceSource, resetAppearanceSource } from '../src/composables/appearance/internal/appearance'
import { s99abTheme } from '../src/theme'

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

// A media query that reports light unless a test overrides it.
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
  resetAppearanceSource()
  prefer()
})

afterEach(() => {
  vi.unstubAllGlobals()
  localStorage.clear()
  resetAppearanceSource()
  document.documentElement.removeAttribute('data-contrast')
})

describe('registerAppearanceSource', () => {
  // A registered dark source decides the opening theme instead of the media query.
  it('lets a source drive dark instead of the media query', async () => {
    prefer({ dark: false })
    registerAppearanceSource({ dark: () => true })

    const theme = inComponent(() => {
      useAppearance()
      return useTheme()
    }, fresh())
    await nextTick()

    expect(theme.global.name.value).toBe('dark')
  })

  // A getter returning undefined falls through to the OS query, so a shell can
  // supply only the accent.
  it('falls through to the media query when a getter returns undefined', async () => {
    prefer({ dark: true })
    registerAppearanceSource({ dark: () => undefined })

    const theme = inComponent(() => {
      useAppearance()
      return useTheme()
    }, fresh())
    await nextTick()

    expect(theme.global.name.value).toBe('dark')
  })

  // A source accent applies on first paint.
  it('applies a source accent on mount', async () => {
    registerAppearanceSource({ accent: () => '#ff0000' })

    const api = inComponent(() => useAppearance(), fresh())
    await nextTick()

    expect(api.accent.value).toBe('#ff0000')
  })

  // And follows later changes from the source.
  it('follows a later accent change from the source', async () => {
    let osAccent = '#ff0000'
    registerAppearanceSource({ accent: () => osAccent })

    const api = inComponent(() => useAppearance(), fresh())
    await nextTick()
    expect(api.accent.value).toBe('#ff0000')

    osAccent = '#00ff00'
    // Nudge the reactive source so the computed re-reads the getter.
    registerAppearanceSource({ accent: () => osAccent })
    await nextTick()

    expect(api.accent.value).toBe('#00ff00')
  })

  // With no source registered, the media query decides dark.
  it('leaves dark resolution to the media query when no source is registered', async () => {
    prefer({ dark: true })

    const theme = inComponent(() => {
      useAppearance()
      return useTheme()
    }, fresh())
    await nextTick()

    expect(theme.global.name.value).toBe('dark')
  })
})

describe('setAccent', () => {
  // The imperative path a themer or settings screen uses.
  it('repaints both themes with the chosen accent', async () => {
    const api = inComponent(() => useAppearance(), fresh())
    await nextTick()

    api.setAccent('#123456')
    await nextTick()

    expect(api.accent.value).toBe('#123456')
  })
})
