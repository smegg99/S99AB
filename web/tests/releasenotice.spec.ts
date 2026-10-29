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
