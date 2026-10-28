// web/tests/disabled-hint.spec.ts
import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from 'vitest'
import { mount, type VueWrapper } from '@vue/test-utils'
import { defineComponent, nextTick, ref } from 'vue'
import DisabledHint from '../src/components/primitives/DisabledHint.vue'
import { vuetifyWith } from './mount'

const vuetify = vuetifyWith({ defaults: { VTooltip: { openDelay: 0, closeDelay: 0, transition: false } } })
// Happy DOM has no visual viewport; Vuetify supports the browser's null case.
beforeAll(() => {
  vi.stubGlobal('visualViewport', null)
})
afterAll(() => {
  vi.unstubAllGlobals()
})
const mounted: VueWrapper[] = []
afterEach(() => {
  mounted.splice(0).forEach(wrapper => wrapper.unmount())
})

// The tooltip binds itself to its parent, the host, a tick after it mounts.
async function render() {
  const action = vi.fn()
  const parentAction = vi.fn()
  const reason = ref('Save the project first.')
  const wrapper = mount(defineComponent({
    components: { DisabledHint },
    setup: () => ({ action, parentAction, reason }),
    template: `<div @click="parentAction" @auxclick="parentAction"><DisabledHint :reason="reason" label="Export" class="sizing"><v-btn :disabled="!!reason" @click="action">Export</v-btn></DisabledHint></div>`,
  }), { attachTo: document.body, global: { plugins: [vuetify] } })
  mounted.push(wrapper)
  await nextTick()
  return { wrapper, reason, action, parentAction, host: wrapper.get('.s99ab-disabled-hint') }
}

describe('disabled reasons', () => {
  it('keeps native disablement and blocks activation from the host and descendants', async () => {
    const { wrapper, host, action, parentAction } = await render()
    expect(wrapper.get('button').attributes('disabled')).toBeDefined()
    expect(host.attributes('tabindex')).toBe('0')
    expect(host.attributes('aria-label')).toBe('Export')
    expect(host.attributes('aria-describedby')).toBeTruthy()
    expect(host.classes()).toContain('sizing')
    await host.trigger('click')
    await wrapper.get('.v-btn__content').trigger('click')
    await host.trigger('auxclick', { button: 1 })
    await wrapper.get('.v-btn__content').trigger('auxclick', { button: 1 })
    await host.trigger('dblclick')
    for (const key of ['Enter', ' ']) {
      const event = new KeyboardEvent('keydown', { key, bubbles: true, cancelable: true })
      expect(host.element.dispatchEvent(event)).toBe(false)
    }
    expect(action).not.toHaveBeenCalled()
    expect(parentAction).not.toHaveBeenCalled()
  })

  it('shows its reason on hover and closes it when the condition changes', async () => {
    const { host, reason } = await render()
    await host.trigger('mouseenter')
    await vi.waitFor(() => expect(document.querySelector('.v-tooltip.v-overlay--active')?.textContent).toContain('Save the project first.'))
    reason.value = ''
    await vi.waitFor(() => expect(document.querySelector('.v-tooltip.v-overlay--active')).toBeNull())
    expect(host.attributes('tabindex')).toBeUndefined()
    expect(host.attributes('aria-describedby')).toBeUndefined()
  })

  it('explains keyboard focus, closes on Escape, and leaves Tab alone', async () => {
    const { host } = await render()
    ;(host.element as HTMLElement).focus()
    await vi.waitFor(() => expect(document.querySelector('.v-tooltip.v-overlay--active')?.textContent).toContain('Save the project first.'))
    const tab = new KeyboardEvent('keydown', { key: 'Tab', bubbles: true, cancelable: true })
    expect(host.element.dispatchEvent(tab)).toBe(true)
    await host.trigger('keydown', { key: 'Escape' })
    await vi.waitFor(() => expect(document.querySelector('.v-tooltip.v-overlay--active')).toBeNull())
  })

  it('lets an enabled control activate without an extra Tab stop or remount', async () => {
    const { wrapper, host, reason, action, parentAction } = await render()
    const button = wrapper.get('button').element
    reason.value = ''
    await wrapper.vm.$nextTick()
    expect(wrapper.get('button').element).toBe(button)
    expect(host.attributes('tabindex')).toBeUndefined()
    await wrapper.get('button').trigger('click')
    expect(action).toHaveBeenCalledOnce()
    expect(parentAction).toHaveBeenCalledOnce()
  })

  it('describes the host only while it has a reason', async () => {
    const { wrapper, host, reason } = await render()
    expect(host.attributes('aria-describedby')).toBeTruthy()
    reason.value = ''
    await nextTick()
    expect(host.attributes('aria-describedby')).toBeUndefined()
    expect(host.attributes('role')).toBeUndefined()
    expect(host.attributes('aria-disabled')).toBeUndefined()
    reason.value = 'Choose a folder first.'
    await vi.waitFor(() => expect(host.attributes('aria-describedby')).toBeTruthy())
    expect(wrapper.get('button').attributes('disabled')).toBeDefined()
  })

  it('is the root, so the consumer\'s scoped classes reach the host', async () => {
    const Consumer = defineComponent({
      components: { DisabledHint },
      __scopeId: 'data-v-consumer',
      template: `<div class="row"><DisabledHint reason="Save the project first." class="row__key"><v-btn disabled>Export</v-btn></DisabledHint></div>`,
    })
    const wrapper = mount(Consumer, { attachTo: document.body, global: { plugins: [vuetify] } })
    mounted.push(wrapper)
    const host = wrapper.get('.row > .s99ab-disabled-hint')
    expect(host.classes()).toContain('row__key')
    expect(host.attributes()).toHaveProperty('data-v-consumer')
  })

  // Two disabled keys side by side: one under the keyboard, one under the
  // pointer. The one opened last is the one shown.
  async function renderPair() {
    const wrapper = mount(defineComponent({
      components: { DisabledHint },
      template: `<div><DisabledHint reason="Save the project first." label="Export"><v-btn disabled>Export</v-btn></DisabledHint><DisabledHint reason="Pick a class first." label="Copy"><v-btn disabled>Copy</v-btn></DisabledHint></div>`,
    }), { attachTo: document.body, global: { plugins: [vuetify] } })
    mounted.push(wrapper)
    await nextTick()
    const [first, second] = wrapper.findAll('.s99ab-disabled-hint').map(each => each.element as HTMLElement)
    return { first: first!, second: second! }
  }
  const shown = () => [...document.querySelectorAll('.v-tooltip.v-overlay--active')].map(each => each.textContent?.trim())

  it('closes a focused reason when the pointer opens another', async () => {
    const { first, second } = await renderPair()
    first.focus()
    await vi.waitFor(() => expect(shown()).toEqual(['Save the project first.']))
    second.dispatchEvent(new MouseEvent('mouseenter'))
    await vi.waitFor(() => expect(shown()).toEqual(['Pick a class first.']))
    second.dispatchEvent(new MouseEvent('mouseleave'))
    await vi.waitFor(() => expect(shown()).toEqual([]))
  })

  it('closes a hovered reason when the keyboard focuses another', async () => {
    const { first, second } = await renderPair()
    first.dispatchEvent(new MouseEvent('mouseenter'))
    await vi.waitFor(() => expect(shown()).toEqual(['Save the project first.']))
    second.focus()
    await vi.waitFor(() => expect(shown()).toEqual(['Pick a class first.']))
  })

  it('keeps a disabled field readable without accepting input or submitting its form', async () => {
    const submit = vi.fn()
    const change = vi.fn()
    const wrapper = mount(defineComponent({
      components: { DisabledHint },
      setup: () => ({ submit, change }),
      template: `<form @submit.prevent="submit"><DisabledHint reason="Choose a class first." label="Group" block><v-text-field model-value="1a" label="Group" disabled @update:model-value="change" /></DisabledHint></form>`,
    }), { attachTo: document.body, global: { plugins: [vuetify] } })
    mounted.push(wrapper)
    const host = wrapper.get('.s99ab-disabled-hint')
    expect(wrapper.get('input').element.value).toBe('1a')
    expect(wrapper.get('input').attributes('disabled')).toBeDefined()
    await host.trigger('keydown', { key: 'Enter' })
    await host.trigger('click')
    expect(submit).not.toHaveBeenCalled()
    expect(change).not.toHaveBeenCalled()
  })
})
