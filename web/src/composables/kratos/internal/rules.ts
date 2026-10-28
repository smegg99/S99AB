// web/src/composables/kratos/internal/rules.ts
//
// Client-side validation for a Kratos-driven field, and short text for the
// messages Kratos answers with.

import type { KratosMessage, KratosNode } from './types'
import { kratosInputType, kratosNodeKind } from './nodes'
import type { Translate } from '../../useTranslate'

/** A Vuetify field rule: true when the value passes, else the message. */
export type Rule = (value: string) => boolean | string

// Only constraints the node states: required and email shape. Kratos does not
// send its password policy, so no length rule.
const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

/** Whether this field holds an email, by type, autocomplete or name. */
export function isKratosEmail(node: KratosNode, identifierIsEmail = false): boolean {
  if (kratosNodeKind(node) !== 'field') return false

  const name = node.attributes.name ?? ''
  return (
    kratosInputType(node) === 'email'
    || node.attributes.autocomplete === 'email'
    || name === 'email'
    || name.endsWith('.email')
    || (identifierIsEmail && name === 'identifier')
  )
}

export function kratosRules(
  node: KratosNode,
  t: Translate,
  identifierIsEmail = false,
): Rule[] {
  if (kratosNodeKind(node) !== 'field') return []

  const rules: Rule[] = []

  if (node.attributes.required) {
    rules.push(v => (v ?? '').trim().length > 0 || t('validation.required', 'Required'))
  }

  if (isKratosEmail(node, identifierIsEmail)) {
    // Passes on empty; the required rule handles emptiness.
    rules.push(v => !v || EMAIL.test(v) || t('validation.email', 'Not an email address'))
  }

  return rules
}

/** Kratos message ids with unambiguous meaning, mapped to short locale keys. */
const SHORT: Record<number, string> = {
  // "The provided credentials are invalid, check for spelling mistakes in your
  // password or username, email address, or phone number."
  4000006: 'auth.msg.badCredentials',
  // "An account with the same identifier (email, phone, username) exists
  // already."
  4000007: 'auth.msg.exists',
  // "The provided credentials are invalid. No credentials found."
  4000028: 'auth.msg.badCredentials',
  // "Please confirm this action by verifying that it is you." (refresh login)
  1010003: 'auth.msg.confirmItIsYou',
  // "Please choose a credential to authenticate yourself with." (registration step two)
  1040009: 'auth.msg.chooseCredential',
  // "An email containing a verification code has been sent to the email
  // address you provided."
  1080003: 'auth.msg.codeSent',
  // "An email containing a recovery code has been sent..."
  1060003: 'auth.msg.codeSent',
  // "Your changes have been saved!"
  1050001: 'auth.msg.saved',
  // "The verification code is invalid or has already been used."
  4070006: 'auth.msg.badCode',
  // "The recovery code is invalid or has already been used."
  4060006: 'auth.msg.badCode',
  // "The password must be at least 8 characters long, but got N." (count dropped)
  4000032: 'auth.msg.passwordShort',
  // "The password has been found in data breaches and must no longer be used."
  4000034: 'auth.msg.passwordBreached',
  // "The password can not be used because it is too similar to the identifier."
  4000031: 'auth.msg.passwordSimilar',
}

/** Short text for a mapped id, else Kratos's own words, also when the key is untranslated. */
export function kratosMessageText(message: KratosMessage, t: Translate): string {
  const key = SHORT[message.id]
  if (!key) return message.text

  const short = t(key, '')
  return short || message.text
}
