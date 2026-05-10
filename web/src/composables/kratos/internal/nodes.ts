// web/src/composables/kratos/internal/nodes.ts
//
// Pure classifiers for one flow node.

import type { KratosMessage, KratosMessageType, KratosNode } from './types'

// Local type, so node helpers do not depend on how translation is wired.
type Translate = (key: string, fallback?: string) => string

/** Node kinds the renderer knows; `unknown` is reported instead of dropped. */
export type KratosNodeKind
  = | 'hidden'
    | 'field'
    | 'checkbox'
    | 'submit'
    | 'button'
    | 'image'
    | 'text'
    | 'anchor'
    | 'script'
    | 'unknown'

export function kratosNodeKind(node: KratosNode): KratosNodeKind {
  switch (node.type) {
    case 'input':
      return inputKind(node)
    // The TOTP QR code.
    case 'img':
      return 'image'
    // Recovery codes and lookup secrets to read off once.
    case 'text':
      return 'text'
    case 'a':
      return 'anchor'
    // WebAuthn and passkey scripts; named, never run.
    case 'script':
      return 'script'
    default:
      return 'unknown'
  }
}

function inputKind(node: KratosNode): KratosNodeKind {
  switch (node.attributes.type) {
    case 'hidden':
      return 'hidden'
    case 'submit':
      return 'submit'
    // Starts a WebAuthn ceremony via onclick; as a submit it would post the form.
    case 'button':
      return 'button'
    case 'checkbox':
      return 'checkbox'
    default:
      return 'field'
  }
}

export function isKratosInput(node: KratosNode): boolean {
  const kind = kratosNodeKind(node)
  return kind === 'field' || kind === 'checkbox'
}

export function isKratosSubmit(node: KratosNode): boolean {
  return kratosNodeKind(node) === 'submit'
}

/** Hidden fields carry the CSRF token and are submitted verbatim. */
export function isKratosHidden(node: KratosNode): boolean {
  return kratosNodeKind(node) === 'hidden'
}

/** The forward submit, as opposed to a multi-step flow's `screen` back button. */
export function isKratosPrimary(node: KratosNode): boolean {
  return node.attributes.name === 'method'
}

/** Kratos's label, else the attribute name. */
export function kratosLabel(node: KratosNode, t?: Translate): string {
  const text
    = node.meta?.label?.text
      ?? node.attributes.text?.text
      ?? node.attributes.name
      ?? ''

  // Kratos labels are English only; translated by stable id. Trait labels
  // (1070002) come from the app's schema and are left alone.
  const id = node.meta?.label?.id
  if (!t || id == null || !TRANSLATED.has(id)) return text

  const own = t(`auth.label.${id}`, '')
  return own || text
}

// Allowlist of label ids with shipped text; vue-i18n warns on every missing key.
const TRANSLATED = new Set([
  1070001, // Password
  1070007, // Email, on recovery and verification
  1070009, // Continue, on recovery and verification
  1010022, // Sign in with password
  1040001, // Sign up
])

// Kratos input types passed through; anything else renders as text.
const fieldTypes = new Set([
  'text', 'email', 'password', 'number', 'tel', 'url', 'date',
  'datetime-local', 'time', 'search', 'color',
])

export function kratosInputType(node: KratosNode): string {
  const type = node.attributes.type ?? ''
  return fieldTypes.has(type) ? type : 'text'
}

// One-time code fields, matched by name; Kratos types them plain text.
const CODE_FIELDS = new Set(['code', 'totp_code', 'lookup_secret'])

export function isKratosCode(node: KratosNode): boolean {
  return kratosNodeKind(node) === 'field' && CODE_FIELDS.has(node.attributes.name ?? '')
}

/** `numeric` for codes; tel would add * and # keys. */
export function kratosInputMode(node: KratosNode): string | undefined {
  if (isKratosCode(node)) {
    return node.attributes.name === 'lookup_secret' ? undefined : 'numeric'
  }
  return undefined
}

/** Kratos's autocomplete, else `one-time-code` for code fields. */
export function kratosAutocomplete(node: KratosNode): string | undefined {
  if (node.attributes.autocomplete) return node.attributes.autocomplete
  return isKratosCode(node) ? 'one-time-code' : undefined
}

/** The node's method group, or `default` (the CSRF token). The form keeps Kratos's order. */
export function kratosGroup(node: KratosNode): string {
  return node.group || 'default'
}

/** Message severity; anything not error or success is info. */
export function kratosSeverity(message: KratosMessage): KratosMessageType {
  return message.type === 'error' || message.type === 'success'
    ? message.type
    : 'info'
}
