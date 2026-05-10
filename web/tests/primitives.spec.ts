// web/tests/primitives.spec.ts

import { createVuetify } from 'vuetify'
import * as components from 'vuetify/components'
import * as directives from 'vuetify/directives'
import { mount } from '@vue/test-utils'
import { nextTick } from 'vue'
import { afterEach, describe, expect, it, vi } from 'vitest'
import Kbd from '../src/components/shortcut/Kbd.vue'
import SearchField from '../src/components/primitives/SearchField.vue'
import Tally from '../src/components/primitives/Tally.vue'
import Thumb from '../src/components/primitives/Thumb.vue'
import { fakeI18n } from './fake-i18n'

const vuetify = createVuetify({ components, directives })

describe('UiKbd', () => {
  afterEach(() => vi.unstubAllGlobals())

  function withPlatform(platform: string) {
    vi.stubGlobal('navigator', { ...navigator, platform, userAgent: platform })
  }

  it('spaces the parts out, so a combination reads as one', () => {
    expect(mount(Kbd, { props: { keys: 'shift+?' } }).text()).toBe('shift + ?')
  })

  // A hardcoded Ctrl is wrong on a Mac. The platform resolves after mount, hence the tick.
  it('resolves mod to the platform key', async () => {
    withPlatform('MacIntel')
    const onMac = mount(Kbd, { props: { keys: 'mod+k' } })
    await nextTick()
    expect(onMac.text()).toBe('Cmd + k')

    withPlatform('Linux x86_64')
    const elsewhere = mount(Kbd, { props: { keys: 'mod+k' } })
    await nextTick()
    expect(elsewhere.text()).toBe('Ctrl + k')
  })

  // The server has no navigator and renders Ctrl; resolving during render would
  // cause a hydration mismatch on macOS.
  it('renders the server-safe cap first, on a Mac too', () => {
    withPlatform('MacIntel')
    expect(mount(Kbd, { props: { keys: 'mod+k' } }).text()).toBe('Ctrl + k')
  })

  it('renders a kbd, not a chip: it is something you press', () => {
    expect(mount(Kbd, { props: { keys: 'a' } }).element.tagName).toBe('KBD')
  })
})

describe('UiSearchField', () => {
  // The name is the aria-label. A floating label does not fit the 44px strip, so
  // the placeholder carries the visible text.
  it('falls back to the layer\'s own name', () => {
    const wrapper = mount(SearchField, {
      props: { modelValue: '' },
      global: { plugins: [vuetify, fakeI18n(k => (k === 'common.search' ? 'Szukaj' : k))] },
    })
    const input = wrapper.find('input')

    expect(input.attributes('aria-label')).toBe('Szukaj')
    expect(input.attributes('placeholder')).toBe('Szukaj')
  })

  it('takes a caller\'s label over it', () => {
    const wrapper = mount(SearchField, {
      props: { modelValue: '', label: 'Find a folder' },
      global: { plugins: [vuetify, fakeI18n(k => k)] },
    })

    expect(wrapper.find('input').attributes('aria-label')).toBe('Find a folder')
  })

  // A placeholder is only an example; the accessible name stays.
  it('keeps the name when a placeholder is given', () => {
    const wrapper = mount(SearchField, {
      props: { modelValue: '', label: 'Find a folder', placeholder: 'invoices' },
      global: { plugins: [vuetify, fakeI18n(k => k)] },
    })
    const input = wrapper.find('input')

    expect(input.attributes('aria-label')).toBe('Find a folder')
    expect(input.attributes('placeholder')).toBe('invoices')
  })

  it('writes back through the model', async () => {
    const wrapper = mount(SearchField, {
      props: { modelValue: '' },
      global: { plugins: [vuetify, fakeI18n(k => k)] },
    })
    await wrapper.find('input').setValue('alpha')

    expect(wrapper.emitted('update:modelValue')?.at(-1)).toEqual(['alpha'])
  })
})

describe('UiTally', () => {
  const cells = [
    { tone: 'success', title: '#1: 200' },
    { tone: 'success', title: '#2: 200' },
    { tone: 'error', title: '#3: 429' },
  ]

  it('draws one cell per outcome, in order', () => {
    const wrapper = mount(Tally, { props: { cells, label: 'requests' } })
    const drawn = wrapper.findAll('.tally__cell')

    expect(drawn).toHaveLength(3)
    expect(drawn[2]!.attributes('title')).toBe('#3: 429')
  })

  // The tone names a theme colour, so callers never pass a colour.
  it('paints each cell from its tone', () => {
    const wrapper = mount(Tally, { props: { cells, label: 'requests' } })
    const drawn = wrapper.findAll('.tally__cell')

    expect(drawn[0]!.attributes('style')).toContain('--v-theme-success')
    expect(drawn[2]!.attributes('style')).toContain('--v-theme-error')
  })

  // The shape is the content, so it needs an accessible name.
  it('names the strip as one image', () => {
    const wrapper = mount(Tally, { props: { cells, label: 'One cell per request' } })

    expect(wrapper.attributes('role')).toBe('img')
    expect(wrapper.attributes('aria-label')).toBe('One cell per request')
  })
})

describe('UiThumb', () => {
  it('is square by default, so a grid of previews is not ragged', () => {
    const wrapper = mount(Thumb, {
      props: { src: '/a.png', alt: 'a' },
      global: { plugins: [vuetify] },
    })
    const style = wrapper.attributes('style') ?? ''

    expect(style).toContain('width: 120px')
    expect(style).toContain('height: 120px')
  })

  it('carries the alt it was given', () => {
    const wrapper = mount(Thumb, {
      props: { src: '/a.png', alt: 'A screenshot' },
      global: { plugins: [vuetify] },
    })
    expect(wrapper.html()).toContain('A screenshot')
  })
})
