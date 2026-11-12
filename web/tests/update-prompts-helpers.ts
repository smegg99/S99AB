// web/tests/update-prompts-helpers.ts
import { defineComponent, h } from 'vue'
import { mount, type VueWrapper } from '@vue/test-utils'
import { createI18n } from 'vue-i18n'
import { vi } from 'vitest'
import { useUpdatePrompts, type UpdatePromptSource } from '../src/composables/releases/useUpdatePrompts'
import { closeAllDialogs, resetDialogs } from '../src/internal/dialog'
import { withS99ab } from '../i18n'

type State = Awaited<ReturnType<UpdatePromptSource['state']>>
const wrappers: VueWrapper[] = []

export function visibility(state: DocumentVisibilityState) {
  Object.defineProperty(document, 'visibilityState', { configurable: true, get: () => state })
  document.dispatchEvent(new Event('visibilitychange'))
}

export function fakeSource(initial: State = { current: '1.4.3', update: { version: '1.5.0' } }) {
  let state = initial
  let callback: ((release: { version: string }) => void) | undefined
  const unsubscribe = vi.fn(() => {
    callback = undefined
  })
  const source = {
    state: vi.fn(async (_locale: string) => state),
    ignore: vi.fn(async (_version: string) => {}),
    notesShown: vi.fn(async () => {}),
    download: vi.fn(async () => {}),
    onAvailable: vi.fn((fn: (release: { version: string }) => void) => {
      callback = fn
      return unsubscribe
    }),
  } satisfies UpdatePromptSource
  return {
    source, unsubscribe,
    setState: (value: State) => { state = value },
    available: (version = '1.5.0') => callback?.({ version }),
  }
}

export function mountPrompts(source: UpdatePromptSource, locale = 'en') {
  const i18n = createI18n({ legacy: false, globalInjection: true, locale, messages: withS99ab({ en: {}, pl: {} }) })
  const wrapper = mount(defineComponent({
    setup() {
      useUpdatePrompts(source)
      return () => h('div')
    },
  }), { global: { plugins: [i18n] } })
  wrappers.push(wrapper)
  return { wrapper, i18n }
}

export function cleanupPrompts() {
  for (const wrapper of wrappers.splice(0)) wrapper.unmount()
  closeAllDialogs()
  resetDialogs()
  visibility('visible')
}
