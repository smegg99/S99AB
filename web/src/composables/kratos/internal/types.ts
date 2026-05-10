// web/src/composables/kratos/internal/types.ts
//
// Kratos response shapes and proxy config. No field names: flows render from the response.

export interface KratosConfig {
  /** Proxy path for Kratos's public API, without a trailing slash. */
  basePath: string
  /** Validates a login's `identifier` as an email; Kratos types it `text`. */
  identifierIsEmail: boolean
  /** Checked on the server to skip whoami when the cookie is absent. */
  sessionCookie: string
}

export const config: KratosConfig = {
  basePath: '/kratos',
  identifierIsEmail: false,
  sessionCookie: 'ory_kratos_session',
}

/** Called by the layer's Nuxt plugin with s99ab.kratos. */
export function configureKratos(patch: Partial<KratosConfig>) {
  Object.assign(config, patch)
}

/** Browser self-service flows; all share the same endpoints and one renderer. */
export type KratosFlowKind
  = | 'login'
    | 'registration'
    | 'settings'
    | 'recovery'
    | 'verification'

export type KratosMessageType = 'error' | 'info' | 'success'

export interface KratosMessage {
  id: number
  text: string
  type: KratosMessageType
}

export interface KratosNodeAttributes {
  name?: string
  type?: string
  value?: unknown
  required?: boolean
  disabled?: boolean
  autocomplete?: string
  /** Label of button and text nodes. */
  text?: { text: string }

  /** img nodes: the TOTP QR code as a data URI. */
  src?: string
  width?: number
  height?: number

  /** a nodes. */
  href?: string
  title?: { text: string }

  /** button nodes: JavaScript for a WebAuthn ceremony; surfaced, never evaluated. */
  onclick?: string

  /** script nodes, for WebAuthn and passkeys. */
  async?: boolean
  crossorigin?: string
  integrity?: string
  referrerpolicy?: string
  nonce?: string
}

export interface KratosNode {
  type: string
  group: string
  attributes: KratosNodeAttributes
  meta?: { label?: { text: string, id?: number } }
  messages?: KratosMessage[]
}

export interface KratosFlow {
  id: string
  ui: {
    action: string
    method: string
    nodes: KratosNode[]
    messages?: KratosMessage[]
  }
}
