// web/tests/button.spec.ts

import { createVuetify } from 'vuetify'
import * as components from 'vuetify/components'
import * as directives from 'vuetify/directives'
import { mount } from '@vue/test-utils'
import { describe, expect, it } from 'vitest'
import Button from '../src/components/primitives/Button.vue'

const vuetify = createVuetify({ components, directives })

function render(props: Record<string, unknown> = {}, slots: Record<string, string> = {}) {
  return mount(Button, {
    props,
    slots: { default: 'Save', ...slots },
    global: { plugins: [vuetify] },
  })
}

// UiButton shows the layer's goo loader while loading, instead of Vuetify's ring.
describe('UiButton while it waits', () => {
  it('shows the layer\'s indicator rather than Vuetify\'s ring', () => {
    const wrapper = render({ loading: true })

    expect(wrapper.find('.s99ab-goo').exists()).toBe(true)
    expect(wrapper.find('.v-progress-circular').exists()).toBe(false)
  })

  it('shows no indicator at rest', () => {
    expect(render().find('.s99ab-goo').exists()).toBe(false)
  })

  // An aria-busy from the wrapper would fall through and override Vuetify's own.
  it('leaves Vuetify\'s own aria-busy alone', () => {
    expect(render({ loading: true }).find('button').attributes('aria-busy')).toBe('true')
    expect(render().find('button').attributes('aria-busy')).toBeUndefined()
  })

  // A bare `loading` attribute arrives as the empty string and still shows the indicator.
  it('shows the indicator for a bare loading attribute too', () => {
    const wrapper = mount(Button, {
      attrs: { loading: '' },
      slots: { default: 'Save' },
      global: { plugins: [vuetify] },
    })

    expect(wrapper.find('.s99ab-goo').exists()).toBe(true)
  })

  // An app's own indicator keeps the wrapper's centring.
  it('lets an app put its own indicator there, inside the wrapper', () => {
    const wrapper = render({ loading: true }, { loader: '<i class="mine">...</i>' })

    expect(wrapper.find('.s99ab-btn__loader .mine').exists()).toBe(true)
    expect(wrapper.find('.s99ab-goo').exists()).toBe(false)
  })
})

// No props of its own: the v-btn API falls through as attributes.
describe('UiButton is still a v-btn', () => {
  it('passes its attributes to the button underneath', () => {
    const wrapper = mount(Button, {
      attrs: { type: 'submit', block: true, color: 'accent', variant: 'flat' },
      slots: { default: 'Sign in' },
      global: { plugins: [vuetify] },
    })

    const button = wrapper.find('button')
    expect(button.attributes('type')).toBe('submit')
    expect(button.classes()).toContain('v-btn--block')
    expect(button.classes()).toContain('v-btn--variant-flat')
    expect(wrapper.text()).toContain('Sign in')
  })

  it('carries the label, prepend and append through', () => {
    const wrapper = render({}, {
      prepend: '<span class="pre">P</span>',
      append: '<span class="post">A</span>',
    })

    expect(wrapper.find('.pre').exists()).toBe(true)
    expect(wrapper.find('.post').exists()).toBe(true)
    expect(wrapper.text()).toContain('Save')
  })

  // Only given slots are forwarded, or v-btn reserves room for an empty prepend.
  it('does not invent the slots it was not given', () => {
    const wrapper = render()

    expect(wrapper.find('.v-btn__prepend').exists()).toBe(false)
    expect(wrapper.find('.v-btn__append').exists()).toBe(false)
  })

  it('emits the click it was given', async () => {
    const wrapper = render()
    await wrapper.find('button').trigger('click')

    expect(wrapper.emitted('click')).toHaveLength(1)
  })
})
