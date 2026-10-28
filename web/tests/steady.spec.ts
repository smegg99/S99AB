// web/tests/steady.spec.ts

import { createPinia } from 'pinia'
import { PiniaColada } from '@pinia/colada'
import { defineComponent, h, nextTick } from 'vue'
import { flushPromises, mount } from '@vue/test-utils'
import { describe, expect, it } from 'vitest'
import AutoHeight from '../src/components/motion/AutoHeight.vue'
import DataTable from '../src/components/table/DataTable.vue'
import { useServerTable } from '../src/composables/table/useServerTable'
import { configureTable } from '../src/composables/table/internal/config'
import { vuetify } from './mount'

function mountTable(rows: number, limit: number, steady = true) {
  const items = Array.from({ length: rows }, (_, i) => ({ id: String(i), name: `Item ${i}` }))

  return mount(defineComponent({
    setup() {
      const table = useServerTable(async () => ({ items, total: rows }), { key: ['steady'], limit })
      return () => h(DataTable, {
        table,
        steady,
        headers: [{ key: 'name', title: 'Name' }],
      })
    },
  }), {
    global: { plugins: [createPinia(), PiniaColada, vuetify] },
  })
}

describe('a steady table', () => {
  // The reserve is a full page of rows, so the footer stays put on a short last page.
  it('reserves a full page whatever the page holds', async () => {
    const wrapper = mountTable(33, 10)
    await flushPromises()

    const table = wrapper.find('.s99ab-table--steady')
    expect(table.exists()).toBe(true)
    expect(table.attributes('style')).toContain('--s99ab-table-rows: 10')
  })

  // Capped at the rows that exist: 100 per page against 32 rows reserves 32.
  it('never reserves more rows than the table can ever hold', async () => {
    const wrapper = mountTable(32, 100)
    await flushPromises()

    expect(wrapper.find('.s99ab-table--steady').attributes('style'))
      .toContain('--s99ab-table-rows: 32')
  })

  // An empty table still needs room for the empty state.
  it('keeps a floor for a table with nothing in it', async () => {
    const wrapper = mountTable(0, 100)
    await flushPromises()

    expect(wrapper.find('.s99ab-table--steady').attributes('style'))
      .toContain('--s99ab-table-rows: 6')
  })

  // The floor comes from app config; restored after so it does not leak.
  it('takes the floor from the app config', async () => {
    configureTable({ emptyRows: 3 })
    try {
      const wrapper = mountTable(0, 100)
      await flushPromises()

      expect(wrapper.find('.s99ab-table--steady').attributes('style'))
        .toContain('--s99ab-table-rows: 3')
    }
    finally {
      configureTable({ emptyRows: 6 })
    }
  })

  it('reserves nothing when the screen opts out', async () => {
    const wrapper = mountTable(3, 10, false)
    await flushPromises()

    expect(wrapper.find('.s99ab-table--steady').exists()).toBe(false)
  })

  // The reserve follows the page size.
  it('follows the page size', async () => {
    const wrapper = mountTable(60, 25)
    await flushPromises()

    expect(wrapper.find('.s99ab-table--steady').attributes('style')).toContain('--s99ab-table-rows: 25')
  })
})

describe('UiAutoHeight', () => {
  it('measures its content and holds that height', async () => {
    const wrapper = mount(AutoHeight, {
      slots: { default: () => h('div', { style: 'height: 120px' }, 'x') },
    })
    await nextTick()

    // happy-dom lays nothing out, so this only checks that an explicit height is set for the transition.
    expect(wrapper.attributes('style')).toContain('height:')
  })

  it('runs at the duration token it was given', async () => {
    const wrapper = mount(AutoHeight, { props: { motion: 'slow' } })
    await nextTick()

    expect(wrapper.attributes('style')).toContain('--autoheight-duration: var(--s99ab-motion-slow)')
  })
})
