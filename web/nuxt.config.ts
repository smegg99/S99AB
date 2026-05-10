// web/nuxt.config.ts
//
// The layer. Apps consume it with extends: ['@smegg99/s99ab'].

import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'
import { s99abIconSubset, s99abModernFonts } from './src/build/assets'

const here = dirname(fileURLToPath(import.meta.url))

export default defineNuxtConfig({
  components: [
    // Ui* prefix; pathPrefix false so concern folders do not rename components.
    // Only .vue is registered, so a .ts helper beside a component is not.
    {
      path: join(here, 'src/components'),
      extensions: ['vue'],
      prefix: 'Ui',
      pathPrefix: false,
    },
  ],

  imports: {
    // The second entry must end in an extension: unimport scans a bare
    // directory one level deep and rewrites a trailing `/*` to the same thing.
    // Support files in `<concern>/internal/` stay out of auto-imports.
    dirs: [
      join(here, 'src/composables'),
      join(here, 'src/composables/*/*.ts'),
    ],
  },

  // No pageTransition: route animation is the app's choice. UiAuthCard animates
  // itself, and UiPage provides the single root an app's own transition needs.

  // The font as a package, so Nuxt resolves the bare specifier.
  css: ['@fontsource-variable/overpass', join(here, 'src/styles/index.scss')],

  // Serves the texture masks at /s99ab/textures/<name>.svg through Nitro, which
  // merges layer config and copies the files on build. The stylesheet builds
  // the same path from $tex-base.
  nitro: {
    publicAssets: [
      { baseURL: 's99ab/textures', dir: join(here, 'public/textures') },
    ],
  },

  vite: {
    resolve: {
      // A linked layer resolves from its own node_modules; a second Vue or Colada
      // instance makes plugins invisible across the copies.
      dedupe: ['vue', 'vue-router', 'pinia', '@pinia/colada', 'vuetify'],
    },

    // Build-time subsetting (src/build/assets.ts). Both passes only remove what
    // the bundle never references. Disable with { disabled: true }.
    plugins: [s99abIconSubset(), s99abModernFonts()],

    define: {
      // The layer uses neither the Legacy API nor <i18n-t>/v-t; dropping them
      // saves about 10 KB of client JS. An app that needs them sets these back.
      __VUE_I18N_LEGACY_API__: false,
      __VUE_I18N_FULL_INSTALL__: false,
      __INTLIFY_PROD_DEVTOOLS__: false,
    },

    // The modulePreload polyfill stays: setting it here is overridden by Nuxt,
    // and forcing it from vite:extendConfig made the client build larger.
  },

  hooks: {
    /*
      Registers the layer's scrollBehavior, since Nuxt only looks in
      <srcDir>/app/router.options. Inserted before every layer's own file, so an
      app's scrollBehavior still wins.
    */
    'pages:routerOptions': ({ files }) => {
      files.splice(1, 0, { path: join(here, 'src/router.options.ts'), optional: true })
    },

  },
})
