// web/tests/translate.spec.ts

import { createI18n } from 'vue-i18n'
import { defineComponent, h } from 'vue'
import { mount } from '@vue/test-utils'
import { describe, expect, it } from 'vitest'
import { useTranslate } from '../src/composables/useTranslate'

// Resolves a key the layer ships and renders the result.
const Probe = defineComponent({
  setup() {
    const t = useTranslate()
    return () => h('span', t('common.retry', 'Retry'))
  },
})

function messages() {
  return { en: { common: { retry: 'Try again' }, auth: { required: 'Sign in to continue.' } } }
}

describe('useTranslate', () => {
  // In composition mode $i18n is a Composer proxy whose `t` is not an own
  // property, so reading $i18n.t returned undefined.
  it('resolves through globalInjection in composition mode', () => {
    const i18n = createI18n({ legacy: false, globalInjection: true, locale: 'en', messages: messages() })
    const wrapper = mount(Probe, { global: { plugins: [i18n] } })

    expect(wrapper.text()).toBe('Try again')
  })

  it('falls back to the supplied text when the app has no i18n at all', () => {
    expect(mount(Probe).text()).toBe('Retry')
  })

  it('falls back when the key is missing, rather than rendering nothing', () => {
    const i18n = createI18n({ legacy: false, globalInjection: true, locale: 'en', messages: { en: {} } })
    const Missing = defineComponent({
      setup() {
        const t = useTranslate()
        return () => h('span', t('common.nope', 'Fallback'))
      },
    })

    expect(mount(Missing, { global: { plugins: [i18n] } }).text()).toBe('Fallback')
  })

  // Without a fallback the key shows, which names what is missing.
  it('renders the key when there is no fallback and no translation', () => {
    const Raw = defineComponent({
      setup() {
        const t = useTranslate()
        return () => h('span', t('auth.required'))
      },
    })

    expect(mount(Raw).text()).toBe('auth.required')
  })
})
