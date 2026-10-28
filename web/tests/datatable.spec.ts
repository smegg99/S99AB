// web/tests/datatable.spec.ts

import { createPinia } from 'pinia'
import { PiniaColada } from '@pinia/colada'
import { defineComponent, h, ref } from 'vue'
import { flushPromises, mount } from '@vue/test-utils'
import { describe, expect, it } from 'vitest'
import DataTable from '../src/components/table/DataTable.vue'
import EmptyState from '../src/components/state/EmptyState.vue'
import ErrorState from '../src/components/state/ErrorState.vue'
import { useServerTable } from '../src/composables/table/useServerTable'
import { vuetify } from './mount'

function mountTable(
  items: { id: string, name: string }[],
  total = items.length,
  extra: Record<string, unknown> = { title: 'Items' },
) {
  return mount(defineComponent({
    setup() {
      const table = useServerTable(async () => ({ items, total }), { key: ['items'], limit: 10 })
      return () => h(DataTable, {
        table,
        headers: [{ key: 'name', title: 'Name', sortable: true }],
        ...extra,
      }, {
        // Dotted column slot names, forwarded dynamically by the host.
        'item.name': ({ item }: { item: { name: string } }) => h('span', item.name),
      })
    },
  }), {
    global: { plugins: [createPinia(), PiniaColada, vuetify] },
  })
}

describe('UiDataTable', () => {
  it('mounts without throwing', () => {
    expect(() => mountTable([{ id: '1', name: 'Alpha' }])).not.toThrow()
  })

  it('forwards a dotted column slot', async () => {
    const wrapper = mountTable([{ id: '1', name: 'Alpha' }])
    await new Promise(r => setTimeout(r, 0))
    expect(wrapper.html()).toContain('Alpha')
  })
})

describe('the search strip', () => {
  it('names the table and drives its search', async () => {
    const wrapper = mountTable([{ id: '1', name: 'Alpha' }])
    await flushPromises()

    expect(wrapper.find('.table__title').text()).toBe('Items')

    const input = wrapper.find('.table__input')
    await input.setValue('alpha')
    // The composable owns the state; the strip only edits it.
    expect(wrapper.findComponent(DataTable).props('table').search.value).toBe('alpha')
  })

  // A clear button inside the search field, shown once there is text.
  it('offers a clear only once there is something to clear', async () => {
    const wrapper = mountTable([{ id: '1', name: 'Alpha' }])
    await flushPromises()
    expect(wrapper.find('.table__search .v-btn').exists()).toBe(false)

    await wrapper.find('.table__input').setValue('alpha')
    await wrapper.find('.table__search .v-btn').trigger('click')

    expect((wrapper.find('.table__input').element as HTMLInputElement).value).toBe('')
  })

  it('draws no strip for a table with nothing to put in one', async () => {
    const wrapper = mountTable([{ id: '1', name: 'Alpha' }], 1, { title: undefined, searchable: false })
    await flushPromises()

    expect(wrapper.find('.table__top').exists()).toBe(false)
  })
})

describe('the frame stays put', () => {
  // A search with no matches keeps the column headings.
  it('keeps the headers and the table when nothing matches', async () => {
    const wrapper = mountTable([], 0)
    await flushPromises()

    expect(wrapper.find('.v-data-table').exists()).toBe(true)
    expect(wrapper.find('thead').text()).toContain('Name')
    expect(wrapper.findComponent(EmptyState).exists()).toBe(true)
  })

  // So does a failed load.
  it('keeps them when the load failed', async () => {
    const wrapper = mount(defineComponent({
      setup() {
        const table = useServerTable(async () => {
          throw new Error('boom')
        }, { key: ['broken'], limit: 10 })
        return () => h(DataTable, { table, title: 'Items', headers: [{ key: 'name', title: 'Name' }] })
      },
    }), {
      global: { plugins: [createPinia(), PiniaColada, vuetify] },
    })
    await flushPromises()

    expect(wrapper.find('.v-data-table').exists()).toBe(true)
    expect(wrapper.find('thead').text()).toContain('Name')
    expect(wrapper.findComponent(ErrorState).exists()).toBe(true)
  })
})

// A filter outside the table must be in the query key, or returning to a seen
// filter serves another filter's cached rows.
describe('a reactive key', () => {
  it('refetches when a filter outside the table moves', async () => {
    const seen: string[] = []
    const status = ref('queued')

    const wrapper = mount(defineComponent({
      setup() {
        const table = useServerTable(async () => {
          seen.push(status.value)
          return { items: [], total: 0 }
        }, { key: () => ['items', status.value], limit: 10 })
        return () => h(DataTable, { table, headers: [{ key: 'name' }] })
      },
    }), { global: { plugins: [createPinia(), PiniaColada, vuetify] } })

    await flushPromises()
    status.value = 'finished'
    await flushPromises()

    expect(seen).toEqual(['queued', 'finished'])
    wrapper.unmount()
  })
})
