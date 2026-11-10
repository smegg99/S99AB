// tests/consumer/nuxt.config.ts
import { defineNuxtConfig } from 'nuxt/config'

export default defineNuxtConfig({
  extends: ['../../web'],
  devtools: { enabled: false },
  app: { head: { link: [{ rel: 'icon', href: 'data:,' }] } },
  css: ['vuetify/styles', '@mdi/font/css/materialdesignicons.css'],
  compatibilityDate: '2026-11-10',
  debug: { hydration: true },
})
