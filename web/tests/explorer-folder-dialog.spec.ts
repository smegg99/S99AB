// web/tests/explorer-folder-dialog.spec.ts

import { createVuetify } from 'vuetify'
import * as components from 'vuetify/components'
import * as directives from 'vuetify/directives'
import { mount } from '@vue/test-utils'
import { describe, expect, it } from 'vitest'
import ExplorerFolderDialog from '../src/components/explorer/ExplorerFolderDialog.vue'

const vuetify = createVuetify({ components, directives })

describe('UiExplorerFolderDialog', () => {
  // Enter closes the dialog on keydown; WebKit would otherwise pass the same
  // Enter to the opener once it gets the focus back.
  it('keeps the Enter that saves from reaching what takes the focus next', async () => {
    const wrapper = mount(ExplorerFolderDialog, {
      props: { title: 'New folder' },
      global: { plugins: [vuetify] },
    })
    const field = wrapper.find('input')
    await field.setValue('Klasy')
    const enter = new KeyboardEvent('keydown', { key: 'Enter', bubbles: true, cancelable: true })
    field.element.dispatchEvent(enter)
    expect(enter.defaultPrevented).toBe(true)
  })

  // A rename selects the old name on open only; a later focus keeps the caret.
  it('picks the old name once when renaming', async () => {
    const wrapper = mount(ExplorerFolderDialog, {
      props: { title: 'Rename folder', name: 'Klasy' },
      global: { plugins: [vuetify] },
    })
    const input = wrapper.find('input').element as HTMLInputElement
    input.setSelectionRange(0, 0)
    await wrapper.find('input').trigger('focus')
    expect([input.selectionStart, input.selectionEnd]).toEqual([0, 5])
    input.setSelectionRange(2, 2)
    await wrapper.find('input').trigger('focus')
    expect([input.selectionStart, input.selectionEnd]).toEqual([2, 2])
  })
})
