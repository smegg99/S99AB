// web/tests/state.spec.ts

import { defineComponent, h, ref } from 'vue'
import { mount } from '@vue/test-utils'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { createVuetify } from 'vuetify'
import * as components from 'vuetify/components'
import * as directives from 'vuetify/directives'
import EmptyState from '../src/components/state/EmptyState.vue'
import ErrorState from '../src/components/state/ErrorState.vue'
import SignInPrompt from '../src/components/state/SignInPrompt.vue'
import { configureAuthPaths } from '../src/composables/kratos/useAuthPaths'
import { toApiError, useApiError } from '../src/composables/state/useApiError'
import { useFirstLoad, useIsEmpty } from '../src/composables/state/useAsyncState'
import { useTranslate } from '../src/composables/useTranslate'
import { fakeI18n } from './fake-i18n'

const vuetify = createVuetify({ components, directives })

function query(data: unknown, error: unknown = undefined, status = 'idle') {
  return { data: ref(data), error: ref(error), asyncStatus: ref(status) }
}

/** Runs fn inside a mounted component. */
function inComponent<T>(fn: () => T, plugins: unknown[] = []): T {
  let out!: T
  mount(
    defineComponent({
      setup() {
        out = fn()
        return () => h('div')
      },
    }),
    { global: { plugins: plugins as never } },
  )
  return out
}

describe('toApiError', () => {
  const envelope = { code: 'not_found', message: 'item.notFound' }

  // Generated clients put the body in different places depending on plugin and throwOnError.
  it('finds the envelope at the top level', () => {
    expect(toApiError(envelope)).toMatchObject({ code: 'not_found' })
  })

  it('finds the envelope on .error', () => {
    expect(toApiError({ error: envelope })).toMatchObject({ code: 'not_found' })
  })

  it('finds the envelope on .data', () => {
    expect(toApiError({ data: envelope })).toMatchObject({ code: 'not_found' })
  })

  it('returns null for anything that is not the envelope', () => {
    expect(toApiError(new Error('connect ECONNREFUSED'))).toBeNull()
    expect(toApiError('a string')).toBeNull()
    expect(toApiError(null)).toBeNull()
    expect(toApiError(undefined)).toBeNull()
    expect(toApiError({ code: 'x' })).toBeNull() // message missing
    expect(toApiError({ message: 'x' })).toBeNull() // code missing
    expect(toApiError({ code: 1, message: 2 })).toBeNull() // wrong types
  })
})

describe('useApiError', () => {
  it('resolves the envelope message and keeps the details', () => {
    const describe_ = inComponent(() => useApiError())
    const out = describe_({
      code: 'validation',
      message: 'item.invalid',
      details: { name: 'too_short' },
    })

    expect(out.code).toBe('validation')
    expect(out.details).toEqual({ name: 'too_short' })
  })

  // A thrown value may carry a URL, a stack or a proxy's HTML; none of it is shown.
  it('never surfaces the text of a non-envelope error', () => {
    const describe_ = inComponent(() => useApiError())
    const out = describe_(new Error('connect ECONNREFUSED 127.0.0.1:9250'))

    expect(out.code).toBe('unknown')
    expect(out.text).not.toContain('ECONNREFUSED')
    expect(out.text).not.toContain('127.0.0.1')
  })

  it('falls back to the key when no translator is installed', () => {
    const describe_ = inComponent(() => useApiError())
    expect(describe_({ code: 'not_found', message: 'item.notFound' }).text)
      .toBe('item.notFound')
  })

  it('uses the translator when one is installed', () => {
    const i18n = fakeI18n(k => k === 'item.notFound' ? 'No such item' : k)
    const describe_ = inComponent(() => useApiError(), [i18n])

    expect(describe_({ code: 'not_found', message: 'item.notFound' }).text)
      .toBe('No such item')
  })
})

describe('useTranslate', () => {
  it('returns the key when i18n is absent', () => {
    expect(inComponent(() => useTranslate())('a.key')).toBe('a.key')
  })

  it('returns the fallback when given one', () => {
    expect(inComponent(() => useTranslate())('a.key', 'Fallback')).toBe('Fallback')
  })

  // vue-i18n echoes the key for a missing message, so the fallback wins.
  it('prefers the fallback over an echoed key', () => {
    expect(inComponent(() => useTranslate(), [fakeI18n(k => k)])('a.key', 'Fallback')).toBe('Fallback')
  })
})

describe('useFirstLoad', () => {
  beforeEach(() => vi.useFakeTimers())
  afterEach(() => vi.useRealTimers())

  // The flag turns true only after the load has run long enough; see tests/delay.spec.ts.
  it('is true once the first load has been in flight long enough', async () => {
    const flag = useFirstLoad(query(undefined, undefined, 'loading'))

    expect(flag.value).toBe(false)
    await vi.advanceTimersByTimeAsync(300)
    expect(flag.value).toBe(true)
  })

  // A background refetch must not blank a screen that has content.
  it('is false while refetching with data present', async () => {
    const flag = useFirstLoad(query({ items: [] }, undefined, 'loading'))
    await vi.advanceTimersByTimeAsync(300)

    expect(flag.value).toBe(false)
  })

  it('is false when idle', async () => {
    const flag = useFirstLoad(query(undefined, undefined, 'idle'))
    await vi.advanceTimersByTimeAsync(300)

    expect(flag.value).toBe(false)
  })
})

describe('useIsEmpty', () => {
  it('detects an empty array', () => {
    expect(useIsEmpty(query([])).value).toBe(true)
    expect(useIsEmpty(query(['a'])).value).toBe(false)
  })

  it('detects an empty page envelope', () => {
    expect(useIsEmpty(query({ items: [], total: 0 })).value).toBe(true)
    expect(useIsEmpty(query({ items: ['a'], total: 1 })).value).toBe(false)
  })

  // Nothing loaded yet differs from loaded and empty.
  it('is false before any data arrives', () => {
    expect(useIsEmpty(query(undefined)).value).toBe(false)
  })

  // A failed load is an error state.
  it('is false when the query errored', () => {
    expect(useIsEmpty(query([], new Error('boom'))).value).toBe(false)
  })
})

describe('a 401', () => {
  it('points at the door rather than reporting a fault', async () => {
    configureAuthPaths({ signInPath: '/login', signUpPath: '/register' })

    const wrapper = mount(ErrorState, {
      props: { error: { code: 'unauthorized', message: 'auth.required' } },
      global: { plugins: [vuetify] },
    })

    expect(wrapper.findComponent(SignInPrompt).exists()).toBe(true)
    expect(wrapper.find('.s99ab-state--error').exists()).toBe(false)
    // Both actions, so the prompt is not a dead end.
    expect(wrapper.findAll('.v-btn')).toHaveLength(2)
  })

  // Without a configured sign-in path it stays an error.
  it('stays an error when the app has no sign-in screen', async () => {
    configureAuthPaths({ signInPath: '', signUpPath: '' })

    const wrapper = mount(ErrorState, {
      props: { error: { code: 'unauthorized', message: 'auth.required' } },
      global: { plugins: [vuetify] },
    })

    expect(wrapper.find('.s99ab-state--error').exists()).toBe(true)
  })
})

// A centred state has no frame and no motion.
describe('UiEmptyState presentation', () => {
  it('is a plain centred block, with no wash to animate', () => {
    const wrapper = mount(EmptyState, {
      props: { title: 'No results' },
      global: { plugins: [vuetify] },
    })
    const root = wrapper.find('.s99ab-state')

    expect(root.classes()).toContain('s99ab-state--center')
    expect(root.classes().some(c => c.includes('dwell'))).toBe(false)
  })
})

// Every slot here is one UiSignInPrompt forwards.
describe('UiEmptyState slots', () => {
  const mountEmpty = (slots: Record<string, unknown>) =>
    mount(EmptyState, {
      props: { title: 'Nothing' },
      slots: slots as never,
      global: { plugins: [vuetify, fakeI18n(k => k)] },
    })

  it('takes a mark above the glyph and a note under the actions', () => {
    const w = mountEmpty({
      prepend: () => h('span', { class: 'lead' }, 'mark'),
      append: () => h('span', { class: 'tail' }, 'note'),
    })

    expect(w.find('.lead').exists()).toBe(true)
    expect(w.find('.tail').exists()).toBe(true)
  })
})

describe('UiSignInPrompt slots', () => {
  const mountPrompt = (slots: Record<string, unknown> = {}) =>
    mount(SignInPrompt, {
      slots: slots as never,
      global: { plugins: [vuetify, fakeI18n(k => k)], stubs: { RouterLink: true } },
    })

  beforeEach(() => {
    configureAuthPaths({ signInPath: '/sign-in', signUpPath: '/sign-up' })
  })

  it('passes a mark and a note through to the state shell', () => {
    const w = mountPrompt({
      prepend: () => h('span', { class: 'lead' }, 'mark'),
      append: () => h('span', { class: 'tail' }, 'note'),
    })

    expect(w.find('.lead').exists()).toBe(true)
    expect(w.find('.tail').exists()).toBe(true)
  })

  // An app's slot replaces both actions.
  it('lets an app replace the two doors outright', () => {
    const w = mountPrompt({ actions: () => h('button', { class: 'sso' }, 'SSO') })

    expect(w.find('.sso').exists()).toBe(true)
    expect(w.find('.v-btn').exists()).toBe(false)
  })

  // Without a path there is nothing to offer, so no empty actions box is drawn.
  it('still draws an actions box for a slot when no path is configured', () => {
    configureAuthPaths({ signInPath: '', signUpPath: '' })
    const w = mountPrompt({ actions: () => h('button', { class: 'sso' }, 'SSO') })

    expect(w.find('.sso').exists()).toBe(true)
  })
})
