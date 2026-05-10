// web/vitest.config.ts

import vue from '@vitejs/plugin-vue'
import { defineConfig } from 'vitest/config'

export default defineConfig({
  // Compiles the layer's .vue files.
  plugins: [vue()],
  test: {
    environment: 'happy-dom',
    include: ['tests/**/*.spec.ts'],
    // Vuetify ships CSS next to its components; without inlining it the
    // externalised import reaches Node, which cannot load a .css file.
    //
    // material-color-utilities is inlined for the neighbouring reason: its own
    // ESM imports its submodules without file extensions, which Node's resolver
    // refuses and Vite's resolves. An app bundles it through Vite and never
    // notices; only a runner that externalises node_modules does.
    server: { deps: { inline: ['vuetify', '@material/material-color-utilities'] } },
  },
})
