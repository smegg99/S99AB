// web/src/composables/kratos/internal/api.ts
//
// The useKratosFlow API, sign-out, session refresh and URL helpers.

import type { ComputedRef, Ref } from 'vue'
import { config } from './types'
import type { KratosFlow, KratosMessage, KratosNode } from './types'

export interface KratosSuccess {
  continue_with?: Array<{ action: string, redirect_browser_to?: string }>
}

/**
 * `expired`: the flow is gone and a new one fixes it. `unreachable`: Kratos or
 * the network failed. `signedIn`/`signedOut`: the flow does not apply to this session.
 */
export type KratosNotice = 'expired' | 'unreachable' | 'signedIn' | 'signedOut'

export interface KratosFlowApi {
  flow: Ref<KratosFlow | null>
  /** Bound to the visible inputs, seeded from the flow. */
  values: Record<string, string>
  pending: Ref<boolean>
  failed: Ref<boolean>
  /** Last problem; set without `failed` when a replaced flow emptied the fields. */
  notice: Ref<KratosNotice | null>
  submitting: Ref<boolean>
  /** All nodes in Kratos's order; the three below are slices of it. */
  nodes: ComputedRef<KratosNode[]>
  inputs: ComputedRef<KratosNode[]>
  hidden: ComputedRef<KratosNode[]>
  submits: ComputedRef<KratosNode[]>
  /** Flow-level messages. */
  messages: ComputedRef<KratosMessage[]>
  messagesFor: (name: string) => KratosMessage[]
  /** Reads the flow named in the URL, or starts a new one. */
  start: () => Promise<void>
  /** Starts a fresh flow in place; `why` becomes the notice. */
  restart: (why?: KratosNotice | null) => Promise<void>
  /** Runs one step; the submitter's name/value tells Kratos which method to run. */
  submit: (form: HTMLFormElement, submitter?: Element | null) => Promise<void>
}

/** Ends the session by navigating to the one-shot `logout_url`. */
export async function kratosSignOut(): Promise<void> {
  if (typeof window === 'undefined') return

  const res = await fetch(`${config.basePath}/self-service/logout/browser`, {
    credentials: 'include',
    headers: { accept: 'application/json' },
  })
  if (!res.ok) throw new Error(`kratos logout ${res.status}`)

  const { logout_url: url } = (await res.json()) as { logout_url?: string }
  if (!url) throw new Error('kratos logout: no logout_url')
  window.location.href = url
}

export function flowIdFromLocation(): string | null {
  if (typeof window === 'undefined') return null
  return new URLSearchParams(window.location.search).get('flow')
}

export interface KratosFlowOptions {
  /** Destination after success; must be in Kratos's allowed_return_urls. */
  returnTo?: string
}

/** Kratos refused the flow because a session already exists. */
export class AlreadySignedIn extends Error {
  constructor() {
    super('kratos: already signed in')
  }
}

/** The flow needs a session and there is none (`session_inactive`). */
export class NotSignedIn extends Error {
  constructor() {
    super('kratos: not signed in')
  }
}
