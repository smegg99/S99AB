// web/src/composables/useTranslate.ts

import { computed, type ComputedRef, getCurrentInstance } from 'vue'

/** Values for a message's `{name}` slots. */
export type TranslateParams = Record<string, string | number>

interface I18nGlobals {
  $t?: (key: string, named?: TranslateParams) => string
  /** The Composer proxy; only `locale` is read. */
  $i18n?: { locale?: string }
}

/**
 * Fills `{name}` slots in a fallback or a host `$t` that leaves them. An
 * unmatched slot is left in place so the wrong name is visible.
 */
function fill(message: string, params: TranslateParams): string {
  return message.replace(/\{(\w+)\}/g, (slot, name: string) =>
    name in params ? String(params[name]) : slot,
  )
}

/**
 * Resolves an i18n key through vue-i18n's `$t` when installed, otherwise
 * returns the key. Reads Vue's app context, so the layer has no Nuxt import and
 * works without i18n. `$t`, not `$i18n.t`, which is not an own property.
 */
export function useTranslate() {
  const globals = getCurrentInstance()?.appContext.config.globalProperties as
    | I18nGlobals
    | undefined

  return (key: string, fallback?: string, params?: TranslateParams): string => {
    if (typeof globals?.$t === 'function') {
      const resolved = globals.$t(key, params)
      // vue-i18n returns the key when the message is missing.
      if (resolved && resolved !== key) {
        // Filled again for a host `$t` that takes only a key and leaves the slots.
        return params ? fill(resolved, params) : resolved
      }
    }
    const raw = fallback ?? key
    return params ? fill(raw, params) : raw
  }
}

/**
 * The current language, or "en" without i18n. Queries for translated content
 * key on it.
 */
export function useLocale(): ComputedRef<string> {
  const globals = getCurrentInstance()?.appContext.config.globalProperties as
    | I18nGlobals
    | undefined

  return computed(() => globals?.$i18n?.locale ?? 'en')
}
