// web/tests/update-dialogs.spec.ts
import { mount } from '@vue/test-utils'
import { describe, expect, it, vi } from 'vitest'
import { createI18n } from 'vue-i18n'
import UpdateDialog from '../src/components/releases/UpdateDialog.vue'
import ReleaseNotesDialog from '../src/components/releases/ReleaseNotesDialog.vue'
import { DIALOG_CLOSE } from '../src/internal/dialog'
import { withS99ab } from '../i18n'
import { vuetify } from './mount'

function localePlugin(locale: string) {
  return createI18n({ legacy: false, globalInjection: true, locale, messages: withS99ab({ en: {}, pl: {} }) })
}

describe('update dialogs', () => {
  for (const locale of ['en', 'pl']) {
    it(`renders the update actions and versions in ${locale}`, async () => {
      const i18n = localePlugin(locale)
      const close = vi.fn()
      const wrapper = mount(UpdateDialog, {
        props: { current: '1.4.3', latest: '1.5.0' },
        global: { plugins: [vuetify, i18n], provide: { [DIALOG_CLOSE]: close } },
      })
      expect(wrapper.text()).toContain(i18n.global.t('release.updateBody', { current: '1.4.3', latest: '1.5.0' }))
      const buttons = wrapper.findAll('button')
      expect(buttons.map(button => button.text())).toEqual([
        i18n.global.t('release.updateIgnore'), i18n.global.t('release.updateLater'), i18n.global.t('release.updateDownload'),
      ])
      expect(wrapper.find('.v-icon').exists()).toBe(false)
      for (const button of buttons) await button.trigger('click')
      expect(close.mock.calls).toEqual([['ignore'], ['later'], ['download']])
      wrapper.unmount()
    })

    it(`renders bundled notes and the close action in ${locale}`, async () => {
      const i18n = localePlugin(locale)
      const close = vi.fn()
      const wrapper = mount(ReleaseNotesDialog, {
        props: { version: '1.5.0', notes: '## Changes\nFixed.', notesLocale: locale },
        global: { plugins: [vuetify, i18n], provide: { [DIALOG_CLOSE]: close } },
      })
      expect(wrapper.text()).toContain(i18n.global.t('release.notesTitle', { version: '1.5.0' }))
      expect(wrapper.text()).toContain('Fixed.')
      const button = wrapper.get('button')
      expect(button.text()).toBe(i18n.global.t('common.close'))
      await button.trigger('click')
      expect(close).toHaveBeenCalledOnce()
      wrapper.unmount()
    })
  }

  it('shows the untranslated message without adding an icon', () => {
    const i18n = localePlugin('pl')
    const wrapper = mount(ReleaseNotesDialog, {
      props: { version: '1.5.0', notes: 'Fixed.', notesLocale: 'en' },
      global: { plugins: [vuetify, i18n] },
    })
    expect(wrapper.text()).toContain(i18n.global.t('release.notTranslated'))
    expect(wrapper.find('.v-icon').exists()).toBe(false)
    wrapper.unmount()
  })
})
