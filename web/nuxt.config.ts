// web/nuxt.config.ts
//
// The layer. Apps consume it with extends: ['@smegg99/s99ab'].

import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'
import { s99abIconSubset, s99abModernFonts } from './src/build/assets'

const here = dirname(fileURLToPath(import.meta.url))

export default defineNuxtConfig({
  plugins: [join(here, 'src/plugins/input.client')],
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

  // No pageTransition: route transitions belong to the app. UiPage is the single
  // root element one needs.

  // fonts.scss first; it corrects Overpass's vertical metrics over fontsource's files.
  css: [join(here, 'src/styles/fonts.scss'), join(here, 'src/styles/index.scss')],

  // Texture masks at /s99ab/textures/<name>.svg. Nuxt does not document merging a
  // layer's public/ dir; Nitro publicAssets do merge. $tex-base in _config.scss must match.
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
      // The layer uses neither the Legacy API nor <i18n-t>/v-t (about 10 KB of client JS).
      __VUE_I18N_LEGACY_API__: false,
      __VUE_I18N_FULL_INSTALL__: false,
      __INTLIFY_PROD_DEVTOOLS__: false,
    },

    // modulePreload polyfill stays: Nuxt overrides it here, and forcing it from
    // vite:extendConfig makes the client build larger.
  },

  hooks: {
    // Adds the layer's scrollBehavior (Nuxt only reads <srcDir>/app/router.options),
    // before every layer's own file so an app's still wins.
    'pages:routerOptions': ({ files }) => {
      files.splice(1, 0, { path: join(here, 'src/router.options.ts'), optional: true })
    },

  },
})
