// web/i18n/index.ts

// The layer's messages in vue-i18n's shape, so an app does not restate them:
//
//   import { withS99ab } from '@smegg99/s99ab/i18n'
//
//   createI18n({ messages: withS99ab({ en, pl }) })
//
// Generated from i18n/locales by `loc build`, one file per namespace. Static
// imports, so the JSON resolves the same way from node_modules.

import authEn from './generated/web/en/auth.json'
import commonEn from './generated/web/en/common.json'
import errorEn from './generated/web/en/error.json'
import explorerEn from './generated/web/en/explorer.json'
import inspectEn from './generated/web/en/inspect.json'
import releaseEn from './generated/web/en/release.json'
import shortcutEn from './generated/web/en/shortcut.json'
import transitionEn from './generated/web/en/transition.json'
import validationEn from './generated/web/en/validation.json'

import authPl from './generated/web/pl/auth.json'
import commonPl from './generated/web/pl/common.json'
import errorPl from './generated/web/pl/error.json'
import explorerPl from './generated/web/pl/explorer.json'
import inspectPl from './generated/web/pl/inspect.json'
import releasePl from './generated/web/pl/release.json'
import shortcutPl from './generated/web/pl/shortcut.json'
import transitionPl from './generated/web/pl/transition.json'
import validationPl from './generated/web/pl/validation.json'

export type Messages = Record<string, unknown>

// Merges per-namespace files into one object per locale.
function assemble(...files: Messages[]): Messages {
  return Object.assign({}, ...files)
}

/** One locale's messages. */
export const s99abMessages: Record<string, Messages> = {
  en: assemble(
    authEn, commonEn, errorEn, explorerEn, inspectEn,
    releaseEn, shortcutEn, transitionEn, validationEn,
  ),
  pl: assemble(
    authPl, commonPl, errorPl, explorerPl, inspectPl,
    releasePl, shortcutPl, transitionPl, validationPl,
  ),
}

/**
 * The app's messages deep-merged over the layer's, per locale. Locales the
 * layer lacks pass through.
 */
export function withS99ab<T extends Record<string, Messages>>(app: T): T {
  const out = {} as Record<string, Messages>

  for (const locale of new Set([...Object.keys(s99abMessages), ...Object.keys(app)])) {
    out[locale] = merge(s99abMessages[locale] ?? {}, app[locale] ?? {})
  }
  return out as T
}

function merge(base: Messages, over: Messages): Messages {
  const out: Messages = { ...base }

  for (const [key, value] of Object.entries(over)) {
    const beneath = out[key]
    out[key] = isGroup(value) && isGroup(beneath)
      ? merge(beneath, value)
      : value
  }
  return out
}

// A message is a string; any other plain object is a group. Arrays replace.
function isGroup(value: unknown): value is Messages {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}
