// web/tests/explorer-swatches.spec.ts

import { nextTick, ref } from 'vue'
import { mount } from '@vue/test-utils'
import { describe, expect, it } from 'vitest'
import ExplorerSwatches from '../src/components/explorer/ExplorerSwatches.vue'
import { vuetify } from './mount'

function render() {
  const model = ref('teal')
  const wrapper = mount(ExplorerSwatches, {
    attachTo: document.body,
    props: {
      'label': 'Accent',
      'options': ['', 'teal', 'rose'],
      'defaultLabel': 'Default',
      'nameOf': (option: string) => ({ teal: 'Morski', rose: 'Różany' })[option] ?? option,
      'modelValue': model.value,
      'onUpdate:modelValue': (next: string) => {
        model.value = next
        void wrapper.setProps({ modelValue: next })
      },
    },
    global: { plugins: [vuetify] },
  })
  return { wrapper, model }
}

describe('UiExplorerSwatches', () => {
  it('is one Tab stop, on the checked tint, named by the app', () => {
    const { wrapper } = render()
    const radios = wrapper.findAll('[role="radio"]')
    expect(radios.map(r => r.attributes('tabindex'))).toEqual(['-1', '0', '-1'])
    expect(radios.map(r => r.attributes('aria-label'))).toEqual(['Default', 'Morski', 'Różany'])
    wrapper.unmount()
  })

  it('moves and checks with the arrows, wrapping, and with Home and End', async () => {
    const { wrapper, model } = render()
    const group = wrapper.get('[role="radiogroup"]')
    await group.trigger('keydown', { key: 'ArrowRight' })
    expect(model.value).toBe('rose')
    await group.trigger('keydown', { key: 'ArrowRight' })
    expect(model.value).toBe('')
    await group.trigger('keydown', { key: 'End' })
    expect(model.value).toBe('rose')
    await nextTick()
    await nextTick()
    expect(document.activeElement?.getAttribute('aria-label')).toBe('Różany')
    wrapper.unmount()
  })
})
