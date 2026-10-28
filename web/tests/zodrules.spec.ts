// web/tests/zodrules.spec.ts

import { defineComponent, h } from 'vue'
import { mount } from '@vue/test-utils'
import { describe, expect, it, vi } from 'vitest'
import { z } from 'zod'
import { useZodForm, useZodRules, type ZodLike } from '../src/composables/useZodRules'
import { fieldSchema } from '../src/internal/zod'
import { fakeI18n } from './fake-i18n'

// Shaped like Hey API output for the demo contract, including optional-with-default.
const zCreateItem = z.object({
  name: z.string().min(1).max(80),
  status: z.enum(['active', 'paused', 'archived']).optional().default('active'),
}) as unknown as ZodLike

const zNested = z.object({
  address: z.object({ city: z.string().min(2) }),
}) as unknown as ZodLike

const zIntersection = z.object({ total: z.int().gte(0) })
  .and(z.object({ items: z.array(z.string()) })) as unknown as ZodLike

function inComponent<T>(fn: () => T): T {
  let out!: T
  mount(defineComponent({
    setup() {
      out = fn()
      return () => h('div')
    },
  }))
  return out
}

describe('fieldSchema', () => {
  it('finds a top-level field', () => {
    expect(fieldSchema(zCreateItem, 'name')).toBeDefined()
  })

  // status is .optional().default(), so the real type is two wrappers down.
  it('unwraps optional and default', () => {
    const field = fieldSchema(zCreateItem, 'status')
    expect(field).toBeDefined()
    expect(field!.safeParse('active').success).toBe(true)
  })

  it('walks a dotted path', () => {
    const field = fieldSchema(zNested, 'address.city')
    expect(field!.safeParse('x').success).toBe(false)
    expect(field!.safeParse('London').success).toBe(true)
  })

  // A generated page envelope is an intersection.
  it('steps through an intersection', () => {
    expect(fieldSchema(zIntersection, 'total')).toBeDefined()
    expect(fieldSchema(zIntersection, 'items')).toBeDefined()
  })

  it('returns undefined for a field that is not there', () => {
    expect(fieldSchema(zCreateItem, 'nope')).toBeUndefined()
  })
})

describe('useZodRules', () => {
  it('accepts a valid value', () => {
    const rules = inComponent(() => useZodRules(zCreateItem))
    expect(rules('name')[0]!('A good name')).toBe(true)
  })

  // The constraint comes from the contract's minLength.
  it('rejects a value that breaks the contract minimum', () => {
    const rules = inComponent(() => useZodRules(zCreateItem))
    expect(rules('name')[0]!('')).not.toBe(true)
  })

  it('rejects a value that breaks the contract maximum', () => {
    const rules = inComponent(() => useZodRules(zCreateItem))
    expect(rules('name')[0]!('x'.repeat(81))).not.toBe(true)
    expect(rules('name')[0]!('x'.repeat(80))).toBe(true)
  })

  it('rejects a value outside an enum', () => {
    const rules = inComponent(() => useZodRules(zCreateItem))
    expect(rules('status')[0]!('weird')).not.toBe(true)
    expect(rules('status')[0]!('paused')).toBe(true)
  })

  // Vuetify returns an empty field as '' or null; the schema decides whether absent is allowed.
  it('treats an empty string as absent', () => {
    const rules = inComponent(() => useZodRules(zCreateItem))
    expect(rules('status')[0]!('')).toBe(true) // optional
    expect(rules('name')[0]!('')).not.toBe(true) // required
  })

  // '' becomes undefined before parsing, so the message is "required".
  it('maps an empty required field to required, not too small', () => {
    const rules = inComponent(() => useZodRules(zCreateItem))
    expect(rules('name')[0]!('')).toBe('validation.required')
  })

  it('maps a present but too-short value to too small', () => {
    const rules = inComponent(() => useZodRules(zNested))
    expect(rules('address.city')[0]!('x')).toBe('validation.tooSmall')
  })

  it('lets an app override one message without losing the rest', () => {
    const rules = inComponent(() =>
      useZodRules(zCreateItem, { messages: { invalid_type: 'item.nameRequired' } }))

    expect(rules('name')[0]!('')).toBe('item.nameRequired')
    expect(rules('name')[0]!('x'.repeat(81))).toBe('validation.tooBig')
  })

  it('interpolates the constraint into the message', () => {
    const i18n = fakeI18n(k => k === 'validation.tooBig' ? 'At most {max} characters' : k)
    let rules!: ReturnType<typeof useZodRules>
    mount(defineComponent({
      setup() {
        rules = useZodRules(zCreateItem)
        return () => h('div')
      },
    }),
    { global: { plugins: [i18n] } })

    expect(rules('name')[0]!('x'.repeat(81))).toBe('At most 80 characters')
  })

  // A wrong field name is a caller bug; blocking the form would hide it.
  it('warns and passes through for an unknown field', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})
    const rules = inComponent(() => useZodRules(zCreateItem))

    expect(rules('nope')).toEqual([])
    expect(warn).toHaveBeenCalledWith(expect.stringContaining('no schema at "nope"'))
    warn.mockRestore()
  })

  it('returns the same rules array for a repeated field', () => {
    const rules = inComponent(() => useZodRules(zCreateItem))
    expect(rules('name')).toBe(rules('name'))
  })
})

describe('useZodForm', () => {
  it('passes a valid object', () => {
    const validate = inComponent(() => useZodForm(zCreateItem))
    const result = validate({ name: 'Fine', status: 'active' })

    expect(result.validate()).toBe(true)
    expect(result.errors).toEqual({})
  })

  it('reports errors keyed by field path', () => {
    const validate = inComponent(() => useZodForm(zCreateItem))
    const result = validate({ name: '', status: 'weird' })

    expect(result.validate()).toBe(false)
    expect(result.errors.name).toBe('validation.tooSmall')
    expect(result.errors.status).toBeDefined()
  })

  it('keys a nested field by its dotted path', () => {
    const validate = inComponent(() => useZodForm(zNested))
    expect(validate({ address: { city: 'x' } }).errors['address.city']).toBeDefined()
  })

  // One message per field.
  it('reports one error per field', () => {
    const validate = inComponent(() => useZodForm(zCreateItem))
    const errors = validate({ name: '' }).errors

    expect(Object.keys(errors).filter(k => k === 'name')).toHaveLength(1)
  })
})
