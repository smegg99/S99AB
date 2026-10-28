// web/tests/prompt-dialog.spec.ts

import { flushPromises, mount } from '@vue/test-utils'
import { describe, expect, it, vi } from 'vitest'
import PromptDialog from '../src/components/overlay/PromptDialog.vue'
import { DIALOG_CLOSE, DIALOG_HOLD } from '../src/internal/dialog'
import type { PromptOptions } from '../src/composables/useDialog'
import { vuetify } from './mount'

function open(options: PromptOptions) {
  const close = vi.fn()
  const hold = vi.fn()
  const wrapper = mount(PromptDialog, {
    props: { options },
    global: { plugins: [vuetify], provide: { [DIALOG_CLOSE]: close, [DIALOG_HOLD]: hold } },
  })
  return { wrapper, close, hold }
}

const buttons = (wrapper: ReturnType<typeof open>['wrapper']) => wrapper.findAll('button')
const byText = (wrapper: ReturnType<typeof open>['wrapper'], text: string) => buttons(wrapper).find(b => b.text() === text)!

describe('UiPromptDialog', () => {
  it('is one frame: the title, the field, the keys at the end', () => {
    const { wrapper } = open({ title: 'Name it', confirmLabel: 'Save', cancelLabel: 'Cancel' })
    expect(wrapper.find('.panel__title').text()).toBe('Name it')
    expect(wrapper.find('.s99ab-dialog__body input').exists()).toBe(true)
    expect(wrapper.find('.s99ab-dialog__actions').text()).toContain('Save')
  })

  it('keeps the confirm key disabled, with the first failing rule as its reason', async () => {
    const { wrapper } = open({ title: 'Name it', confirmLabel: 'Save', rules: [v => !!v.trim() || 'Type a name.'] })
    expect(byText(wrapper, 'Save').attributes('disabled')).toBeDefined()
    expect(wrapper.find('.s99ab-disabled-hint--disabled').attributes('aria-label')).toBe('Save')
    await wrapper.find('input').setValue('A')
    expect(byText(wrapper, 'Save').attributes('disabled')).toBeUndefined()
  })

  it('keeps a refusal from submit under the field with the dialog open, and closes once it is taken', async () => {
    const submit = vi.fn().mockResolvedValueOnce('The name is taken.').mockResolvedValueOnce(undefined)
    const { wrapper, close } = open({ title: 'Name it', confirmLabel: 'Save', value: 'A', submit })
    await byText(wrapper, 'Save').trigger('click')
    await flushPromises()
    expect(submit).toHaveBeenCalledWith('A')
    expect(close).not.toHaveBeenCalled()
    expect(wrapper.text()).toContain('The name is taken.')
    await byText(wrapper, 'Save').trigger('click')
    await flushPromises()
    expect(close).toHaveBeenCalledWith('A')
  })

  it('runs the second action at the start of the keys and closes with no answer', async () => {
    const run = vi.fn().mockResolvedValue(undefined)
    const { wrapper, close } = open({ title: 'Rename', value: 'A', secondary: { label: 'Remove the name', run } })
    const start = wrapper.find('.s99ab-dialog__actions').element.firstElementChild
    expect(start?.textContent).toContain('Remove the name')
    await byText(wrapper, 'Remove the name').trigger('click')
    await flushPromises()
    expect(run).toHaveBeenCalled()
    expect(close).toHaveBeenCalledWith(undefined)
  })

  it('shows a save that throws under the field, stays open and can be tried again', async () => {
    const submit = vi.fn().mockRejectedValueOnce(new Error('network down'))
    const { wrapper, close } = open({ title: 'Name it', confirmLabel: 'Save', value: 'A', submit })
    await byText(wrapper, 'Save').trigger('click')
    await flushPromises()
    expect(close).not.toHaveBeenCalled()
    expect(wrapper.text()).toContain('Something went wrong.')
    expect(byText(wrapper, 'Save').attributes('disabled')).toBeUndefined()
  })

  it('holds the dialog open, with cancel off, until the save settles', async () => {
    let settle!: (said?: string) => void
    const submit = vi.fn(() => new Promise<string | undefined>((resolve) => {
      settle = resolve
    }))
    const { wrapper, close, hold } = open({ title: 'Name it', confirmLabel: 'Save', cancelLabel: 'Cancel', value: 'A', submit })
    await byText(wrapper, 'Save').trigger('click')
    expect(hold).toHaveBeenLastCalledWith(true)
    expect(byText(wrapper, 'Cancel').attributes('disabled')).toBeDefined()
    await byText(wrapper, 'Cancel').trigger('click')
    expect(close).not.toHaveBeenCalled()
    settle()
    await flushPromises()
    expect(hold).toHaveBeenLastCalledWith(false)
    expect(close).toHaveBeenCalledWith('A')
  })

  it('keeps the field focusable while a save runs', async () => {
    const submit = vi.fn(() => new Promise<string | undefined>(() => {}))
    const { wrapper } = open({ title: 'Name it', confirmLabel: 'Save', value: 'A', submit })
    await byText(wrapper, 'Save').trigger('click')
    const input = wrapper.find('input')
    expect(input.attributes('disabled')).toBeUndefined()
    expect(input.attributes('readonly')).toBeDefined()
  })
})
