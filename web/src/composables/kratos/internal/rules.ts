// web/src/composables/kratos/internal/rules.ts
//
// Client-side validation for a Kratos-driven field, and short text for the
// messages Kratos answers with.

import type { KratosMessage, KratosNode } from './types'
import { kratosInputType, kratosNodeKind } from './nodes'

/** A Vuetify field rule: true when the value passes, else the message. */
export type Rule = (value: string) => boolean | string

type Translate = (key: string, fallback?: string) => string

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
  // "Please confirm this action by verifying that it is you." - the whole of
  // what a refresh login says, and the only thing explaining why somebody who
  // is already signed in is being asked for their password again.
  1010003: 'auth.msg.confirmItIsYou',
  // "Please choose a credential to authenticate yourself with." - step two of
  // a v1.3 registration opens with it, so it is the first thing a reader sees
  // after giving their address, and it was the last English sentence left on a
  // Polish sign-up.
  1040009: 'auth.msg.chooseCredential',
}

/** Short text for a mapped id, else Kratos's own words, also when the key is untranslated. */
export function kratosMessageText(message: KratosMessage, t: Translate): string {
  const key = SHORT[message.id]
  if (!key) return message.text

  const short = t(key, '')
  return short || message.text
}
