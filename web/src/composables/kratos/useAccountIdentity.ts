// web/src/composables/kratos/useAccountIdentity.ts

import {
  computed,
  toValue,
  type ComputedRef,
  type MaybeRefOrGetter,
} from 'vue'

/** The signed-in identity as the app reports it; the layer never fetches it. */
export interface AccountIdentity {
  email?: string
  /** Display name; the email stands in when absent. */
  name?: string
}

export interface AccountIdentityApi {
  /** Display name, or the email. */
  name: ComputedRef<string>
  /** The email, when it is not already the name. */
  secondary: ComputedRef<string | undefined>
  initials: ComputedRef<string>
}

export function useAccountIdentity(
  identity: MaybeRefOrGetter<AccountIdentity | null | undefined>,
): AccountIdentityApi {
  const name = computed(() => {
    const who = toValue(identity)
    return who?.name || who?.email || ''
  })

  const secondary = computed(() => {
    const email = toValue(identity)?.email
    return email && email !== name.value ? email : undefined
  })

  // Avatar images come through the slot; this is the stable fallback.
  const initials = computed(() => {
    const full = name.value.trim()
    if (!full) return '?'

    // A dotted local part splits too: carol.danvers@ gives CD.
    const [first = '', second = ''] = full.split(/[\s._-]+/).filter(Boolean)
    // slice keeps this typechecking under noUncheckedIndexedAccess.
    if (second) return (first.slice(0, 1) + second.slice(0, 1)).toUpperCase()
    return full.slice(0, 2).toUpperCase()
  })

  return { name, secondary, initials }
}
