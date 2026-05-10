// web/src/composables/useZodRules.ts

import { useTranslate, type TranslateParams } from './useTranslate'

/** The slice of zod used here, typed structurally because zod is an optional peer. */
export interface ZodLike {
  safeParse: (value: unknown) => {
    success: boolean
    error?: { issues: ZodIssue[] }
  }
}

/** zod internals reached by cast, since `def` differs per schema kind. */
interface ZodInternal extends ZodLike {
  shape?: Record<string, ZodInternal>
  def?: {
    innerType?: ZodInternal
    left?: ZodInternal
    right?: ZodInternal
  }
}

export interface ZodIssue {
  code: string
  message: string
  /** zod types this as PropertyKey[]. */
  path: PropertyKey[]
  minimum?: number | bigint
  maximum?: number | bigint
  /** not_multiple_of carries its factor here. */
  divisor?: number | bigint
  format?: string
}

/** A Vuetify rule: true when valid, otherwise the message to show. */
export type Rule = (value: unknown) => true | string

/** Issue code to i18n key. An app overrides any of them per call. */
export const DEFAULT_MESSAGES: Record<string, string> = {
  too_small: 'validation.tooSmall',
  too_big: 'validation.tooBig',
  invalid_type: 'validation.required',
  invalid_format: 'validation.format',
  invalid_value: 'validation.invalidValue',
  not_multiple_of: 'validation.step',
  custom: 'validation.invalid',
}

const FALLBACK = 'validation.invalid'

/**
 * Constraint values for the message's `{name}` slots, passed to the translator
 * because vue-i18n empties slots it gets no value for.
 */
function issueParams(issue: ZodIssue): TranslateParams {
  const params: TranslateParams = {}
  if (issue.minimum !== undefined) params.min = String(issue.minimum)
  if (issue.maximum !== undefined) params.max = String(issue.maximum)
  if (issue.divisor !== undefined) params.divisor = String(issue.divisor)
  return params
}

/**
 * Walks to a field's schema along a dotted path, unwrapping optional, default
 * and nullable and stepping through intersections.
 */
export function fieldSchema(
  schema: ZodLike,
  path: string,
): ZodLike | undefined {
  let current: ZodInternal | undefined = schema as ZodInternal

  for (const key of path.split('.')) {
    current = unwrap(current)
    if (!current) return undefined

    const shape = current.shape ?? shapeOfIntersection(current)
    current = shape?.[key]
    if (!current) return undefined
  }
  return current
}

function unwrap(schema: ZodInternal | undefined): ZodInternal | undefined {
  let current = schema
  // Optional, nullable and default wrap the real type in def.innerType.
  while (current && !current.shape && current.def?.innerType) {
    current = current.def.innerType
  }
  return current
}

function shapeOfIntersection(
  schema: ZodInternal,
): Record<string, ZodInternal> | undefined {
  const { left, right } = schema.def ?? {}
  if (!left && !right) return undefined
  return { ...unwrap(left)?.shape, ...unwrap(right)?.shape }
}

export interface ZodRulesOptions {
  /** Override any issue code's i18n key. */
  messages?: Record<string, string>
}

/** Vuetify rules generated from a contract schema. The server still validates. */
export function useZodRules(schema: ZodLike, options: ZodRulesOptions = {}) {
  const t = useTranslate()
  const messages = { ...DEFAULT_MESSAGES, ...options.messages }
  const cache = new Map<string, Rule[]>()

  function describe(issue: ZodIssue): string {
    const key = messages[issue.code] ?? FALLBACK
    // Falls back to the key, like useApiError.
    return t(key, undefined, issueParams(issue))
  }

  return function rules(path: string): Rule[] {
    const cached = cache.get(path)
    if (cached) return cached

    const field = fieldSchema(schema, path)
    if (!field) {
      // A missing path is a caller bug: warn and let the field through.
      if (typeof console !== 'undefined') {
        console.warn(
          `[s99ab] no schema at "${path}" - is the field name right?`,
        )
      }
      cache.set(path, [])
      return []
    }

    const rule: Rule = (value) => {
      // An empty field ('' or null) is absent; the schema decides if that is allowed.
      const parsed = field.safeParse(value === '' ? undefined : value)
      if (parsed.success) return true

      const issue = parsed.error?.issues[0]
      return issue ? describe(issue) : t(FALLBACK, 'Invalid')
    }

    const out = [rule]
    cache.set(path, out)
    return out
  }
}

export interface ZodFormResult<T> {
  validate: () => boolean
  errors: Record<string, string>
  parsed?: T
}

/** Whole-object validation for submit, from the same schema as the field rules. */
export function useZodForm<T>(schema: ZodLike, options: ZodRulesOptions = {}) {
  const t = useTranslate()
  const messages = { ...DEFAULT_MESSAGES, ...options.messages }

  return function validate(value: unknown): ZodFormResult<T> {
    const parsed = schema.safeParse(value)
    if (parsed.success) {
      return { validate: () => true, errors: {}, parsed: value as T }
    }

    const errors: Record<string, string> = {}
    for (const issue of parsed.error?.issues ?? []) {
      // A symbol key has no field to point at.
      const path
        = issue.path.filter(k => typeof k !== 'symbol').join('.') || '_'
      // The first issue per field is shown.
      errors[path] ??= t(
        messages[issue.code] ?? FALLBACK,
        undefined,
        issueParams(issue),
      )
    }
    return { validate: () => false, errors }
  }
}
