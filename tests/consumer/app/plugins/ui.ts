// tests/consumer/app/plugins/ui.ts
import { defineNuxtPlugin } from 'nuxt/app'
import { createVuetify } from 'vuetify'
import * as components from 'vuetify/components'
import * as directives from 'vuetify/directives'
import { aliases, mdi } from 'vuetify/iconsets/mdi'
import { en, pl } from 'vuetify/locale'
import { createI18n } from 'vue-i18n'
import { s99abTheme } from '../../../../web/src/theme'
import { withS99ab } from '../../../../web/i18n'

export default defineNuxtPlugin((app) => {
  app.vueApp.use(createVuetify({
    ssr: true,
    ...s99abTheme(), components, directives,
    icons: { defaultSet: 'mdi', aliases, sets: { mdi } },
    locale: { locale: 'en', fallback: 'en', messages: { en, pl } },
  }))
  app.vueApp.use(createI18n({ legacy: false, locale: 'en', messages: withS99ab({ en: {}, pl: {} }) }))
})
