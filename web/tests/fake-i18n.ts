// web/tests/fake-i18n.ts

import type { App, Plugin } from 'vue'

/**
 * A vue-i18n stand-in that installs only `$t`, as vue-i18n does under
 * globalInjection. tests/translate.spec.ts checks the real one.
 */
export function fakeI18n(t: (key: string) => string): Plugin {
  return {
    install(app: App) {
      app.config.globalProperties.$t = t
    },
  }
}
