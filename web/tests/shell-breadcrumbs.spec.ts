// web/tests/shell-breadcrumbs.spec.ts

import { defineComponent, h, nextTick } from 'vue'
import { mount } from '@vue/test-utils'
import { createMemoryHistory, createRouter } from 'vue-router'
import { describe, expect, it } from 'vitest'
import { useBreadcrumbs } from '../src/composables/shell/useBreadcrumbs'
import type { NavGroup } from '../src/types'

const groups: NavGroup[] = [{
  label: 'Main',
  items: [
    { label: 'Home', to: '/' },
    { label: 'Files', to: '/files', children: [{ label: 'Shared', to: '/files/shared' }] },
    { label: 'Help', to: '/files/help', newTab: true },
  ],
}]

async function crumbsAt(path: string) {
  const router = createRouter({ history: createMemoryHistory(), routes: [{ path: '/:any(.*)*', component: { render: () => null } }] })
  await router.push(path)
  let trail: { label: string }[] = []
  mount(defineComponent({
    setup() {
      const crumbs = useBreadcrumbs(groups)
      return () => {
        trail = crumbs.trail.value
        return h('div')
      }
    },
  }), { global: { plugins: [router] } })
  await nextTick()
  return trail.map(c => c.label)
}

describe('useBreadcrumbs', () => {
  it('names the deepest link the route sits under', async () => {
    expect(await crumbsAt('/files/shared/x')).toEqual(['Main', 'Shared'])
    expect(await crumbsAt('/files/report')).toEqual(['Main', 'Files'])
  })

  it('falls back to the root link and never to a new-tab one', async () => {
    expect(await crumbsAt('/settings')).toEqual(['Main', 'Home'])
    expect(await crumbsAt('/files/help')).toEqual(['Main', 'Files'])
  })
})
