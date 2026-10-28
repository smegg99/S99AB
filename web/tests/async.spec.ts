// web/tests/async.spec.ts

import { h, ref, type Component } from 'vue'
import { mount } from '@vue/test-utils'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import Async from '../src/components/state/Async.vue'
import Row from '../src/components/primitives/Row.vue'
import Stack from '../src/components/primitives/Stack.vue'
import { configureDelay } from '../src/internal/delay'
import { fakeI18n } from './fake-i18n'
import { vuetify } from './mount'

function query(data: unknown, error: unknown = undefined, status = 'idle') {
  return { data: ref(data), error: ref(error), asyncStatus: ref(status) }
}

function mountAsync(props: Record<string, unknown>, slots: Record<string, unknown> = {}) {
  return mount(Async, {
    // The helper takes a partial bag of props.
    props: props as never,
    slots: {
      default: () => h('div', { class: 'content' }, 'rows'),
      empty: () => h('div', { class: 'empty' }, 'nothing here'),
      ...slots,
    },
    global: { plugins: [vuetify, fakeI18n(k => k)] },
  })
}

describe('UiAsync', () => {
  beforeEach(() => {
    vi.useFakeTimers()
    // Pacing is tested in delay.spec; here it only has to be crossable.
    configureDelay({ appearAfter: 10, holdFor: 0 })
  })

  afterEach(() => {
    vi.useRealTimers()
    configureDelay({ appearAfter: 220, holdFor: 450 })
  })

  it('shows the content when the query has rows', () => {
    const w = mountAsync({ query: query({ items: [1, 2] }) })

    expect(w.find('.content').exists()).toBe(true)
    expect(w.find('.empty').exists()).toBe(false)
  })

  it('shows the empty slot when the query succeeded with nothing', () => {
    const w = mountAsync({ query: query({ items: [] }) })

    expect(w.find('.empty').exists()).toBe(true)
    expect(w.find('.content').exists()).toBe(false)
  })

  // Emptiness derived on the client is invisible to the query object.
  it('takes the caller\'s word for emptiness over its own', () => {
    const w = mountAsync({ query: query({ items: [1, 2] }), empty: true })

    expect(w.find('.empty').exists()).toBe(true)
    expect(w.find('.content').exists()).toBe(false)
  })

  it('reports a failure instead of the content', () => {
    const w = mountAsync({ query: query(undefined, new Error('nope')) })

    expect(w.find('[role="alert"]').exists()).toBe(true)
    expect(w.find('.content').exists()).toBe(false)
  })

  it('emits retry from the error state', async () => {
    const w = mountAsync({ query: query(undefined, new Error('nope')) })

    await w.find('[role="alert"] button').trigger('click')
    expect(w.emitted('retry')).toHaveLength(1)
  })

  // A refetch keeps existing content on screen instead of flashing a skeleton.
  it('keeps the content on screen while refetching', async () => {
    const q = query({ items: [1] })
    const w = mountAsync({ query: q })

    q.asyncStatus.value = 'loading'
    vi.advanceTimersByTime(50)
    await w.vm.$nextTick()

    expect(w.find('.content').exists()).toBe(true)
    expect(w.find('[role="status"]').exists()).toBe(false)
  })

  it('shows the skeleton once a first load has run long enough', async () => {
    const q = query(undefined, undefined, 'loading')
    const w = mountAsync({ query: q })

    vi.advanceTimersByTime(50)
    await w.vm.$nextTick()

    expect(w.find('[role="status"]').exists()).toBe(true)
    expect(w.find('.content').exists()).toBe(false)
  })

  // A load that finishes before the threshold shows no skeleton.
  it('shows nothing for a load that finishes before the threshold', async () => {
    const q = query(undefined, undefined, 'loading')
    const w = mountAsync({ query: q })

    q.data.value = { items: [1] }
    q.asyncStatus.value = 'idle'
    // Let the watcher see the change before the clock moves.
    await w.vm.$nextTick()
    vi.advanceTimersByTime(50)
    await w.vm.$nextTick()

    expect(w.find('[role="status"]').exists()).toBe(false)
    expect(w.find('.content').exists()).toBe(true)
  })

  // ErrorState is a bordered box, so it is inset inside a flush panel.
  it('insets a state, and never the content', () => {
    const failing = mountAsync({ query: query(undefined, new Error('nope')) })
    expect(failing.find('.s99ab-async__state').exists()).toBe(true)

    const loaded = mountAsync({ query: query({ items: [1] }) })
    expect(loaded.find('.s99ab-async__state').exists()).toBe(false)
  })

  it('drops the inset inside a body that already pads', () => {
    const w = mountAsync({ query: query(undefined, new Error('nope')), flush: true })

    expect(w.find('.s99ab-async__state').exists()).toBe(false)
    expect(w.find('[role="alert"]').exists()).toBe(true)
  })
})

describe('UiStack and UiRow', () => {
  // The two components take different prop shapes, so the mount options are cast.
  function classesOf(component: Component, props: Record<string, unknown> = {}) {
    const options = {
      props,
      slots: { default: () => h('div') },
      global: { plugins: [vuetify] },
    }
    return mount(component, options as never).classes()
  }

  // The gap is a role from _config.scss.
  it('names a spacing role rather than a number', () => {
    expect(classesOf(Stack)).toContain('s99ab-stack--gap')
    expect(classesOf(Stack, { gap: 'tight' })).toContain('s99ab-stack--tight')
    expect(classesOf(Stack, { gap: 'control' })).toContain('s99ab-stack--control')
    expect(classesOf(Row, { gap: 'control' })).toContain('s99ab-row--control')
  })

  // Rows wrap by default.
  it('wraps unless told not to', () => {
    expect(classesOf(Row)).not.toContain('s99ab-row--nowrap')
    expect(classesOf(Row, { wrap: false })).toContain('s99ab-row--nowrap')
  })

  it('aligns on the cross axis', () => {
    expect(classesOf(Row)).toContain('s99ab-row--center')
    expect(classesOf(Row, { align: 'stretch' })).toContain('s99ab-row--stretch')
  })
})

describe('UiAsync before the first response', () => {
  // `empty` is ignored while data is undefined, so the empty state does not
  // flash before the content.
  it('is not empty while there is no data, whatever the caller says', () => {
    const w = mountAsync({ query: query(undefined), empty: true })

    // The content branch, rendering the caller's own empty list.
    expect(w.find('.empty').exists()).toBe(false)
    expect(w.find('.content').exists()).toBe(true)
  })

  // Once data is in, the caller's `empty` is final.
  it('takes the caller\'s word once the data is there', () => {
    const w = mountAsync({ query: query({ runs: [1, 2] }), empty: true })

    expect(w.find('.empty').exists()).toBe(true)
  })
})
