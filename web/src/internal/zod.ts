// web/src/internal/zod.ts

import type { ZodLike } from '../composables/useZodRules'

/** zod internals reached by cast, since `def` differs per schema kind. */
export interface ZodInternal extends ZodLike {
  shape?: Record<string, ZodInternal>
  def?: {
    innerType?: ZodInternal
    left?: ZodInternal
    right?: ZodInternal
  }
}

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

export const FALLBACK = 'validation.invalid'

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

export function unwrap(schema: ZodInternal | undefined): ZodInternal | undefined {
  let current = schema
  // Optional, nullable and default wrap the real type in def.innerType.
  while (current && !current.shape && current.def?.innerType) {
    current = current.def.innerType
  }
  return current
}

export function shapeOfIntersection(
  schema: ZodInternal,
): Record<string, ZodInternal> | undefined {
  const { left, right } = schema.def ?? {}
  if (!left && !right) return undefined
  return { ...unwrap(left)?.shape, ...unwrap(right)?.shape }
}
