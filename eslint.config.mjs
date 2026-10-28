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
    // The standard's script order (C2) and import order (C6): vue, vuetify, components,
    // composables, browser, then the rest, type-only imports last.
    files: ['web/src/**/*.{ts,vue}', 'web/plugins/**/*.ts', 'web/tests/**/*.ts'],
    rules: {
      'vue/define-macros-order': ['error', {
        order: ['defineOptions', 'defineProps', 'defineEmits', 'defineModel', 'defineSlots'],
        defineExposeLast: true,
      }],
      'import/order': ['error', {
        'groups': ['builtin', 'external', ['internal', 'parent', 'sibling', 'index'], 'object', 'type'],
        'pathGroups': [
          { pattern: 'vue', group: 'external', position: 'before' },
          { pattern: 'vuetify{,/**}', group: 'external', position: 'before' },
          { pattern: '{.,..,../..,../../..}/**/*.vue', group: 'parent', position: 'before' },
          { pattern: '{.,..,../..,../../..}/{composables,**/composables}/**', group: 'parent' },
          { pattern: '{.,..,../..,../../..}/{browser,**/browser}{,/**}', group: 'parent', position: 'after' },
        ],
        'pathGroupsExcludedImportTypes': ['builtin'],
        'distinctGroup': false,
        'newlines-between': 'never',
      }],
    },
  })
  .append({
    ignores: ['node_modules', '.nuxt', 'dist', '.output', 'web/i18n/generated'],
  })
