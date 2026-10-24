import { effectScope, nextTick } from 'vue'
import { expect, it } from 'vitest'
import { useTabs, type WorkspaceTab } from '../src/composables/tabs/useTabs'

type Tab = WorkspaceTab & { file: string, part: string }
const create = () => useTabs<Tab, { file: string, part: string }>({
  home: { id: 'home', pinned: true, file: '', part: '' },
  make: place => ({ ...place }), read: tab => ({ file: tab.file, part: tab.part }),
  apply: (tab, place) => Object.assign(tab, place),
  key: tab => `${tab.file}:${tab.part}`, isHome: place => !place.file,
})

it('keeps navigation history across tab activation and filters removed places', async () => {
  const scope = effectScope()
  const tabs = scope.run(create)!
  const first = tabs.open({ file: 'one', part: 'text' })
  await nextTick()
  const second = tabs.open({ file: 'two', part: 'text' }, { newTab: true })
  tabs.activate(second.id)
  await nextTick()
  tabs.go(-1)
  expect(tabs.active.value.id).toBe(first.id)
  tabs.closeWhere(place => place.file === 'two')
  await nextTick()
  expect(tabs.canGo.value.forward).toBe(false)
  scope.stop()
})

it('keeps a transferring source until release and deduplicates only within one collection', () => {
  const scope = effectScope()
  scope.run(() => {
    const source = create()
    const target = create()
    const tab = source.open({ file: 'one', part: 'text' })
    tab.moving = true
    source.closeAll()
    expect(source.tabs.value).toHaveLength(2)
    const adopted = target.adopt(tab, 'transfer:one', 0)
    expect(target.adopt(tab, 'transfer:one', 1)).toBe(adopted)
    expect(target.tabs.value[0]?.pinned).toBe(true)
    expect(source.tabs.value).toHaveLength(2)
    source.release(tab.id)
    expect(tab.departed).toBe(true)
    expect(source.tabs.value).toHaveLength(1)
    expect(target.tabs.value).toHaveLength(2)
  })
  scope.stop()
})
