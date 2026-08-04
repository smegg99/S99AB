// web/vitest.config.ts

import vue from '@vitejs/plugin-vue'
import { defineConfig } from 'vitest/config'

export default defineConfig({
  // Compiles the layer's .vue files.
  plugins: [vue()],
  test: {
    environment: 'happy-dom',
    include: ['tests/**/*.spec.ts'],
    // Pins the DOM capabilities the suite assumes.
    setupFiles: ['tests/setup.ts'],
    // Vuetify imports CSS, and material-color-utilities imports without file
    // extensions; Node cannot load either when externalised.
    server: { deps: { inline: ['vuetify', '@material/material-color-utilities'] } },
  },
})
