// web/tests/dialog-focus.spec.ts
import { defineComponent, h, nextTick } from 'vue'
import { flushPromises, mount } from '@vue/test-utils'
import { describe, expect, it, vi } from 'vitest'
import { createVuetify } from 'vuetify'
import * as components from 'vuetify/components'
import * as directives from 'vuetify/directives'
import { VDialog } from 'vuetify/components'
import { focusStart } from '../src/browser/focus'
import { DEFAULTS } from '../src/theme'

describe('transition-free modal focus on WebKitGTK', () => {
  it('keeps Unidentified Shift+Tab and forward Tab inside the dialog', async () => {
    vi.stubGlobal('visualViewport', Object.assign(new EventTarget(), { width: 1024, height: 768, offsetTop: 0, offsetLeft: 0, scale: 1 }))
    const start = focusStart()
    window.addEventListener('keydown', start.keydown, true)
    const wrapper = mount(defineComponent({
      setup: () => () => h(VDialog, { modelValue: true }, {
        default: () => h('div', [
          h('button', { id: 'dialog-first' }, 'First'),
          h('button', { disabled: true }, 'Disabled'),
          h('button', { id: 'dialog-last' }, 'Last'),
        ]),
      }),
    }), { attachTo: document.body, global: { plugins: [createVuetify({ components, directives, defaults: DEFAULTS })] } })
    try {
      await flushPromises()
      await nextTick()
      const first = document.getElementById('dialog-first')!
      const last = document.getElementById('dialog-last')!
      for (const el of [first, last]) Object.defineProperty(el, 'offsetParent', { value: document.body })
      first.focus()
      const back = new KeyboardEvent('keydown', { key: 'Unidentified', code: 'Tab', shiftKey: true, bubbles: true, cancelable: true })
      first.dispatchEvent(back)
      expect(back.defaultPrevented).toBe(true)
      expect(document.activeElement).toBe(last)
      const forward = new KeyboardEvent('keydown', { key: 'Tab', code: 'Tab', bubbles: true, cancelable: true })
      last.dispatchEvent(forward)
      expect(forward.defaultPrevented).toBe(true)
      expect(document.activeElement).toBe(first)
    }
    finally {
      window.removeEventListener('keydown', start.keydown, true)
      wrapper.unmount()
      vi.unstubAllGlobals()
    }
  })
})
