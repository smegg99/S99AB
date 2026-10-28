// web/tests/dialog-host.spec.ts

import { defineComponent, h } from 'vue'
import * as components from 'vuetify/components'
import { flushPromises, mount } from '@vue/test-utils'
import { beforeEach, describe, expect, it } from 'vitest'
import DialogHost from '../src/components/overlay/DialogHost.vue'
import { dialogEntries, resetDialogs } from '../src/internal/dialog'
import { useDialog } from '../src/composables/useDialog'
import { vuetify } from './mount'

// happy-dom has no visualViewport, and VOverlay's setup throws without one.
Object.defineProperty(globalThis, 'visualViewport', {
  configurable: true,
  value: { addEventListener() {}, removeEventListener() {} },
})

// The resolver injected into the dialog, captured so the wiring can be asserted.
let injectedClose: ((value?: unknown) => void) | undefined

const Stub = defineComponent({
  name: 'Stub',
  setup() {
    injectedClose = useDialog().close
    return () => h('div', { class: 'stub' })
  },
})

function mountHost() {
  return mount(DialogHost, { global: { plugins: [vuetify] } })
}

beforeEach(() => {
  resetDialogs()
  injectedClose = undefined
})

describe('UiDialogHost', () => {
  it('renders the component the stack was opened with', async () => {
    const host = mountHost()
    void useDialog().openDialog(Stub)
    await flushPromises()

    expect(host.findComponent(Stub).exists()).toBe(true)
    host.unmount()
  })

  // One provide per entry, which is why the slot is its own component.
  it('settles the promise when the dialog closes itself', async () => {
    const host = mountHost()
    const promise = useDialog<string>().openDialog<string>(Stub)
    await flushPromises()

    injectedClose!('saved')

    await expect(promise).resolves.toBe('saved')
    expect(dialogEntries).toHaveLength(0)
    host.unmount()
  })

  // Backdrop and escape arrive as model-value false and settle as cancelled.
  it('settles as cancelled when the dialog reports itself dismissed', async () => {
    const host = mountHost()
    const promise = useDialog().openDialog(Stub)
    await flushPromises()

    host.findComponent(components.VDialog).vm.$emit('update:modelValue', false)

    await expect(promise).resolves.toBeUndefined()
    expect(dialogEntries).toHaveLength(0)
    host.unmount()
  })

  // The stack is module state, so dialogs open when the host unmounts are settled.
  it('settles a dialog that is still open when the host goes away', async () => {
    const host = mountHost()
    const promise = useDialog().openDialog(Stub)
    await flushPromises()
    expect(dialogEntries).toHaveLength(1)

    host.unmount()

    await expect(promise).resolves.toBeUndefined()
    expect(dialogEntries).toHaveLength(0)
  })
})
