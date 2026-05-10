// eslint.config.mjs
//
// Standalone flat config: the @nuxt/eslint module needs a built .nuxt, which a
// layer never has.

import { createConfigForNuxt } from '@nuxt/eslint-config/flat'

export default createConfigForNuxt({
  features: { stylistic: true },
})
  .append({
    // Linted without the consumer's auto-imports; the layer imports explicitly.
    files: ['web/src/**/*.{ts,vue}', 'web/plugins/**/*.ts'],
    rules: {
      'no-undef': 'off',
    },
  })
  .append({
    // The Nuxt preset exempts layouts only at the lint root, not under web/.
    files: ['web/src/components/**/*.vue', 'web/layouts/**/*.vue'],
    rules: {
      // Components get the 'Ui' prefix (Panel.vue is UiPanel); layouts are
      // named by file.
      'vue/multi-word-component-names': 'off',
    },
  })
  .append({
    ignores: ['node_modules', '.nuxt', 'dist', '.output', 'web/i18n/generated'],
  })
