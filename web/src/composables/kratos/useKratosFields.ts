// web/src/composables/kratos/useKratosFields.ts

import { computed, type ComputedRef } from 'vue'
import { kratosSeverity } from './internal/nodes'
import type { KratosFlowApi, KratosNode } from './useKratosFlow'

export interface KratosFieldsApi {
  /** Nodes to render, in the order Kratos sent them. */
  renderable: ComputedRef<KratosNode[]>
  errorsFor: (name: string) => string[]
  /** Non-error messages, such as the password policy hint. */
  hintsFor: (name: string) => string[]
}

/**
 * The renderable half of a flow, and each field's messages split by severity.
 *
 * A field can carry a hint as well as a failure - Kratos sends its password
 * policy as an info message on the password node - and putting both under
 * error-messages paints a valid field red.
 */
export function useKratosFields(flow: KratosFlowApi): KratosFieldsApi {
  function texts(name: string, failures: boolean): string[] {
    if (!name) return []
    return flow
      .messagesFor(name)
      .filter(m => (kratosSeverity(m) === 'error') === failures)
      .map(m => m.text)
  }

  return {
    // Unfiltered: the component reports nodes it cannot draw.
    renderable: computed(() => flow.nodes.value),
    errorsFor: name => texts(name, true),
    hintsFor: name => texts(name, false),
  }
}
