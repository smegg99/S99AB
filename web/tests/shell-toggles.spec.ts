// web/tests/shell-toggles.spec.ts

import { mount } from '@vue/test-utils'
import { describe, expect, it } from 'vitest'
import ContrastToggle from '../src/components/shell/ContrastToggle.vue'
import ThemeToggle from '../src/components/shell/ThemeToggle.vue'
import { vuetify } from './mount'

describe('the appearance toggles', () => {
  it.each([
    ['theme', ThemeToggle, 'Dark theme'],
    ['contrast', ContrastToggle, 'High contrast'],
  ])('%s: draws its icon, names one state and reports it pressed or not', (_, toggle, name) => {
    const wrapper = mount(toggle, { global: { plugins: [vuetify] } })
    const button = wrapper.get('button')
    expect(button.find('.v-icon').exists()).toBe(true)
    expect(button.attributes('aria-label')).toBe(name)
    expect(button.attributes('aria-pressed')).toBe('false')
    expect(button.attributes('title')).toBeUndefined()
    wrapper.unmount()
  })
})
