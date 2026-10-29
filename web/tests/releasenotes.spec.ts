// web/tests/releasenotes.spec.ts

import { mount } from '@vue/test-utils'
import { describe, expect, it } from 'vitest'
import { createI18n } from 'vue-i18n'
import ReleaseNotes from '../src/components/releases/ReleaseNotes.vue'
import { vuetify } from './mount'

function mountNotes(locale: string, notesLocale: string) {
  const i18n = createI18n({ legacy: false, globalInjection: true, locale, messages: { [locale]: {} } })
  return mount(ReleaseNotes, { props: { notes: 'Fixed.', notesLocale }, global: { plugins: [vuetify, i18n] } })
}

describe('UiReleaseNotes', () => {
  // The API answers with the base tag it matched.
  it('reads a regional locale as its language', () => {
    expect(mountNotes('pl-PL', 'pl').find('.v-alert').exists()).toBe(false)
  })

  it('says the notes are in another language when they are', () => {
    expect(mountNotes('de', 'en').find('.v-alert').exists()).toBe(true)
  })
})
