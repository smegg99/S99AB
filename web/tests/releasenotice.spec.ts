// web/tests/releasenotice.spec.ts

import { mount } from '@vue/test-utils'
import { describe, expect, it } from 'vitest'
import ReleaseNotice from '../src/components/releases/ReleaseNotice.vue'
import { vuetify } from './mount'

function mountNotice(props: Record<string, unknown> = {}) {
  return mount(ReleaseNotice, { props, global: { plugins: [vuetify] } })
}

describe('UiReleaseNotice', () => {
  it('says beta and offers feedback by default', () => {
    const wrapper = mountNotice({ text: 'Expect changes.', linkHref: 'https://example.test/issues' })
    expect(wrapper.text()).toContain('Beta')
    expect(wrapper.text()).toContain('Expect changes.')
    const link = wrapper.find('a')
    expect(link.attributes('href')).toBe('https://example.test/issues')
    expect(link.text()).toBe('Share feedback or report a problem')
  })

  it('has no link without a target', () => {
    expect(mountNotice({ title: 'Preview' }).find('a').exists()).toBe(false)
  })
})

describe('UiReleaseNotice semantics', () => {
  // A standing notice is not an alert: it would be announced on every page load.
  it('is a note, named by its own text', () => {
    const wrapper = mountNotice({ text: 'Expect changes.' })
    const root = wrapper.find('.v-alert')
    expect(root.attributes('role')).toBe('note')
    expect(root.attributes('aria-label')).toBeUndefined()
  })

  it('stripes in the tone it is given', () => {
    const wrapper = mountNotice({ tone: 'info' })
    expect(wrapper.find('.v-alert').attributes('style')).toContain('--s99ab-notice: var(--v-theme-info)')
  })
})
