// web/src/composables/kratos/useKratosFields.ts

import { computed, type ComputedRef } from 'vue'
import { kratosSeverity } from './internal/nodes'
import { kratosMessageText } from './internal/rules'
import type { KratosFlowApi, KratosNode } from './useKratosFlow'

export interface KratosFieldsApi {
  /** Nodes to render, in the order Kratos sent them. */
  renderable: ComputedRef<KratosNode[]>
  errorsFor: (name: string) => string[]
  /** Non-error messages, such as the password policy hint. */
  hintsFor: (name: string) => string[]
}

/**
 * A flow's renderable nodes and each field's messages split by severity.
 * @param t Translator for field messages; without it they stay in English.
 */
export function useKratosFields(
  flow: KratosFlowApi,
  t?: (key: string, fallback?: string) => string,
): KratosFieldsApi {
  function texts(name: string, failures: boolean): string[] {
    if (!name) return []
    return flow
      .messagesFor(name)
      .filter(m => (kratosSeverity(m) === 'error') === failures)
      .map(m => (t ? kratosMessageText(m, t) : m.text))
  }

  return {
    // Unfiltered: the component reports nodes it cannot draw.
    renderable: computed(() => flow.nodes.value),
    errorsFor: name => texts(name, true),
    hintsFor: name => texts(name, false),
  }
}
