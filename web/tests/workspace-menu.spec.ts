// web/tests/workspace-menu.spec.ts
import { afterAll, afterEach, beforeAll, describe, expect, it, onTestFinished, vi } from 'vitest'
import { mount, type VueWrapper } from '@vue/test-utils'
import { nextTick } from 'vue'
import { createVuetify } from 'vuetify'
import * as components from 'vuetify/components'
import DisabledHint from '../src/components/primitives/DisabledHint.vue'
import WorkspaceMenu from '../src/components/tabs/WorkspaceMenu.vue'
import { closeContextMenu, openContextMenu, useContextMenuState } from '../src/composables/tabs/internal/contextMenu'

const vuetify = createVuetify({ components, defaults: { VMenu: { transition: false, scrollStrategy: 'none' }, VTooltip: { openDelay: 0, closeDelay: 0, transition: false } } })
beforeAll(() => {
  vi.stubGlobal('visualViewport', null)
})
afterAll(() => {
  vi.unstubAllGlobals()
})
let wrapper: VueWrapper | undefined
afterEach(() => {
  closeContextMenu()
  wrapper?.unmount()
})

describe('workspace disabled menu entries', () => {
  it('explains a disabled action without executing it or closing the menu', async () => {
    const run = vi.fn()
    wrapper = mount(WorkspaceMenu, { attachTo: document.body, global: { plugins: [vuetify] } })
    openContextMenu(new MouseEvent('contextmenu', { clientX: 10, clientY: 10 }), [
      { key: 'remove', title: 'Remove', disabled: true, disabledReason: 'Select a row first.', run },
    ])
    await vi.waitFor(() => expect(document.querySelector('.ctx .s99ab-disabled-hint')).not.toBeNull())
    const host = document.querySelector('.ctx .s99ab-disabled-hint') as HTMLElement
    host.dispatchEvent(new MouseEvent('mouseenter'))
    await vi.waitFor(() => expect(document.querySelector('.v-tooltip.v-overlay--active')?.textContent).toContain('Select a row first.'))
    host.click()
    host.querySelector('.v-list-item')?.dispatchEvent(new MouseEvent('click', { bubbles: true }))
    expect(run).not.toHaveBeenCalled()
    expect(useContextMenuState().open).toBe(true)
    expect(host.tabIndex).toBe(0)
  })

  it('explains unavailable submenu actions and leaves the submenu open', async () => {
    const run = vi.fn()
    wrapper = mount(WorkspaceMenu, { attachTo: document.body, global: { plugins: [vuetify] } })
    openContextMenu(new MouseEvent('contextmenu', { clientX: 10, clientY: 10 }), [
      { key: 'move', title: 'Move', children: [{ key: 'locked', title: 'Locked folder', disabled: true, disabledReason: 'This folder is read only.', run }] },
    ])
    await vi.waitFor(() => expect(document.querySelector('.ctx .v-list-item')).not.toBeNull())
    document.querySelector('.ctx .v-list-item')?.dispatchEvent(new MouseEvent('mouseenter'))
    await vi.waitFor(() => expect(document.querySelector('.ctx [aria-label="Locked folder"]')).not.toBeNull())
    const host = document.querySelector('.ctx [aria-label="Locked folder"]') as HTMLElement
    host.dispatchEvent(new MouseEvent('mouseenter'))
    await vi.waitFor(() => expect(document.querySelector('.v-tooltip.v-overlay--active')?.textContent).toContain('This folder is read only.'))
    host.click()
    expect(run).not.toHaveBeenCalled()
    expect(useContextMenuState().open).toBe(true)
  })

  it('opens every reason beside its row, off the next one', async () => {
    wrapper = mount(WorkspaceMenu, { attachTo: document.body, global: { plugins: [vuetify] } })
    openContextMenu(new MouseEvent('contextmenu', { clientX: 10, clientY: 10 }), [
      { key: 'back', title: 'Back', disabled: true, disabledReason: 'No earlier place.' },
      { key: 'move', title: 'Move', children: [{ key: 'locked', title: 'Locked folder', disabled: true, disabledReason: 'This folder is read only.' }] },
    ])
    await vi.waitFor(() => expect(document.querySelector('.ctx .s99ab-disabled-hint')).not.toBeNull())
    const hints = wrapper.findAllComponents(DisabledHint)
    expect(hints).toHaveLength(2)
    for (const hint of hints) expect(hint.props('location')).toBe('end')
  })

  const shown = () => [...document.querySelectorAll('.v-tooltip.v-overlay--active')].map(each => each.textContent?.trim())

  it('shows an enabled entry\'s hint on hover and keyboard focus, and a disabled entry its reason', async () => {
    wrapper = mount(WorkspaceMenu, { attachTo: document.body, global: { plugins: [vuetify] } })
    openContextMenu(new MouseEvent('contextmenu', { clientX: 10, clientY: 10 }), [
      { key: 'paste', title: 'Paste 2 lessons from 1a', hint: 'Maths and Physics', run: vi.fn() },
      { key: 'remove', title: 'Remove', disabled: true, disabledReason: 'Select a row first.', hint: 'Every lesson of 1a' },
    ])
    await vi.waitFor(() => expect(document.querySelectorAll('.ctx .v-list-item')).toHaveLength(2))
    const paste = document.querySelector<HTMLElement>('.ctx .v-list-item')!
    paste.dispatchEvent(new MouseEvent('mouseenter'))
    await vi.waitFor(() => expect(shown()).toEqual(['Maths and Physics']))
    paste.dispatchEvent(new MouseEvent('mouseleave'))
    await vi.waitFor(() => expect(shown()).toEqual([]))
    // Vuetify takes no focus for a tooltip in the 50ms after it closed.
    await new Promise(resolve => setTimeout(resolve, 60))
    paste.focus()
    await vi.waitFor(() => expect(shown()).toEqual(['Maths and Physics']))
    // The disabled row under the pointer takes over from the focused one.
    document.querySelector('.ctx .s99ab-disabled-hint--disabled')!.dispatchEvent(new MouseEvent('mouseenter'))
    await vi.waitFor(() => expect(shown()).toEqual(['Select a row first.']))
    expect(document.body.textContent).not.toContain('Every lesson of 1a')
  })

  it('shows a submenu entry\'s hint, and none on the entry its submenu opens from', async () => {
    wrapper = mount(WorkspaceMenu, { attachTo: document.body, global: { plugins: [vuetify] } })
    openContextMenu(new MouseEvent('contextmenu', { clientX: 10, clientY: 10 }), [
      { key: 'move', title: 'Move', hint: 'Into another folder', children: [{ key: 'archive', title: 'Archive', hint: 'Kept for a year', run: vi.fn() }] },
    ])
    await vi.waitFor(() => expect(document.querySelector('.ctx .v-list-item')).not.toBeNull())
    document.querySelector('.ctx .v-list-item')!.dispatchEvent(new MouseEvent('mouseenter'))
    await vi.waitFor(() => expect(document.querySelectorAll('.ctx .v-list-item')).toHaveLength(2))
    expect(shown()).toEqual([])
    document.querySelectorAll('.ctx .v-list-item')[1]!.dispatchEvent(new MouseEvent('mouseenter'))
    await vi.waitFor(() => expect(shown()).toEqual(['Kept for a year']))
    expect(document.body.textContent).not.toContain('Into another folder')
  })

  // A long hint stays off its entry and the right-clicked row
  // (tests/hint-placement.spec.ts has the placement).
  it('places every hint, a submenu entry\'s too, on the menu\'s far side rather than where Vuetify flips it', async () => {
    wrapper = mount(WorkspaceMenu, { attachTo: document.body, global: { plugins: [vuetify] } })
    openContextMenu(new MouseEvent('contextmenu', { clientX: 10, clientY: 10 }), [
      { key: 'paste', title: 'Paste 2 lessons from 1a', hint: 'Maths and Physics', run: vi.fn() },
      { key: 'move', title: 'Move', children: [{ key: 'archive', title: 'Archive', hint: 'Kept for a year', run: vi.fn() }] },
    ])
    await vi.waitFor(() => expect(document.querySelectorAll('.ctx .v-list-item')).toHaveLength(2))
    document.querySelectorAll('.ctx .v-list-item')[1]!.dispatchEvent(new MouseEvent('mouseenter'))
    await vi.waitFor(() => expect(document.querySelectorAll('.ctx .v-list-item')).toHaveLength(3))
    const hints = wrapper.findAllComponents(components.VTooltip).filter(tooltip => tooltip.props('text') !== undefined)
    expect(hints.map(hint => hint.props('text'))).toEqual(['Maths and Physics', 'Kept for a year'])
    for (const hint of hints) expect(hint.props('locationStrategy')).toBeTypeOf('function')
  })

  // The menu of row 1b at x 520 in a 1024x700 window.
  it('wraps the hint narrower beside its entry, off the right-clicked row, when the menu\'s end has little room', async () => {
    const row = document.createElement('button')
    document.body.append(row)
    onTestFinished(() => row.remove())
    const box = (left: number, top: number, right: number, bottom: number) => ({ left, top, right, bottom, width: right - left, height: bottom - top })
    // A plate of 560px of text on lines 22px high, padded 5px above and below.
    const plateSize = (el: HTMLElement) => {
      const width = Math.min(parseFloat(el.style.maxWidth) || 560, 560)
      return { width, height: Math.ceil(560 / width) * 22 + 10 }
    }
    vi.spyOn(Element.prototype, 'getBoundingClientRect').mockImplementation(function (this: Element) {
      if (this === row) return box(229, 182, 550, 214) as DOMRect
      if (this.matches('.ctx .v-list-item')) return box(521, 207, 771, 235) as DOMRect
      if (this.classList.contains('v-overlay__content') && this.querySelector('.ctx')) return box(521, 205, 771, 397) as DOMRect
      if (this.matches('.v-tooltip .v-overlay__content')) return plateSize(this as HTMLElement) as DOMRect
      return box(0, 0, 0, 0) as DOMRect
    })
    vi.spyOn(document.documentElement, 'clientWidth', 'get').mockReturnValue(1024)
    vi.spyOn(document.documentElement, 'clientHeight', 'get').mockReturnValue(700)
    onTestFinished(() => {
      vi.restoreAllMocks()
    })
    row.focus()
    wrapper = mount(WorkspaceMenu, { attachTo: document.body, global: { plugins: [vuetify] } })
    openContextMenu(new MouseEvent('contextmenu', { clientX: 520, clientY: 198 }), [
      { key: 'paste', title: 'Paste 10 lessons from 1a', hint: 'Maths, Polish, History, Civics, Physics, Geography, Religion, Form time, Chemistry, Biology', run: vi.fn() },
    ])
    await vi.waitFor(() => expect(document.querySelector('.ctx .v-list-item')).not.toBeNull())
    document.querySelector('.ctx .v-list-item')!.dispatchEvent(new MouseEvent('mouseenter'))
    await vi.waitFor(() => expect(document.querySelector<HTMLElement>('.v-tooltip.v-overlay--active .v-overlay__content')?.style.left).toBe('781px'))
    const plate = document.querySelector<HTMLElement>('.v-tooltip.v-overlay--active .v-overlay__content')!
    expect(plate.style.maxWidth).toBe('231px')
    expect(plate.style.top).toBe('183px')
  })

  // A submenu entry's hint also keeps clear of the right-clicked row.
  it('keeps a submenu entry\'s hint off the row the menu was opened on', async () => {
    const row = document.createElement('button')
    document.body.append(row)
    onTestFinished(() => row.remove())
    const box = (left: number, top: number, right: number, bottom: number) => ({ left, top, right, bottom, width: right - left, height: bottom - top })
    // A plate of 560px of text on lines 22px high, padded 5px above and below.
    const plateSize = (el: HTMLElement) => {
      const width = Math.min(parseFloat(el.style.maxWidth) || 560, 560)
      return { width, height: Math.ceil(560 / width) * 22 + 10 }
    }
    vi.spyOn(Element.prototype, 'getBoundingClientRect').mockImplementation(function (this: Element) {
      if (this === row) return box(229, 182, 1000, 214) as DOMRect
      if (this.matches('.v-tooltip .v-overlay__content')) return plateSize(this as HTMLElement) as DOMRect
      const sub = this.textContent?.includes('Archive') && !this.textContent.includes('Move')
      if (this.matches('.ctx .v-list-item')) return (sub ? box(551, 209, 801, 237) : box(301, 207, 551, 235)) as DOMRect
      if (this.matches('.ctx') || (this.classList.contains('v-overlay__content') && this.querySelector('.ctx'))) {
        return (sub ? box(551, 207, 801, 277) : box(301, 205, 551, 397)) as DOMRect
      }
      return box(0, 0, 0, 0) as DOMRect
    })
    vi.spyOn(document.documentElement, 'clientWidth', 'get').mockReturnValue(1024)
    vi.spyOn(document.documentElement, 'clientHeight', 'get').mockReturnValue(700)
    onTestFinished(() => {
      vi.restoreAllMocks()
    })
    row.focus()
    wrapper = mount(WorkspaceMenu, { attachTo: document.body, global: { plugins: [vuetify] } })
    openContextMenu(new MouseEvent('contextmenu', { clientX: 300, clientY: 198 }), [
      { key: 'move', title: 'Move', children: [{ key: 'archive', title: 'Archive', hint: 'Maths, Polish, History, Civics, Physics, Geography, Religion, Form time', run: vi.fn() }] },
    ])
    await vi.waitFor(() => expect(document.querySelector('.ctx .v-list-item')).not.toBeNull())
    document.querySelector('.ctx .v-list-item')!.dispatchEvent(new MouseEvent('mouseenter'))
    await vi.waitFor(() => expect(document.querySelectorAll('.ctx .v-list-item')).toHaveLength(2))
    document.querySelectorAll('.ctx .v-list-item')[1]!.dispatchEvent(new MouseEvent('mouseenter'))
    // Beside the submenu, 201px wide and 76px high: centred on its entry it would
    // span y 185-261, over the row (182-214); it steps above the row instead.
    await vi.waitFor(() => expect(document.querySelector<HTMLElement>('.v-tooltip.v-overlay--active .v-overlay__content')?.style.left).toBe('811px'))
    const plate = document.querySelector<HTMLElement>('.v-tooltip.v-overlay--active .v-overlay__content')!
    expect(plate.style.maxWidth).toBe('201px')
    expect(plate.style.top).toBe('106px')
  })

  it('opens no hint by itself when the same entries come back', async () => {
    const entries = [{ key: 'paste', title: 'Paste 2 lessons from 1a', hint: 'Maths and Physics', run: vi.fn() }]
    wrapper = mount(WorkspaceMenu, { attachTo: document.body, global: { plugins: [vuetify] } })
    openContextMenu(new MouseEvent('contextmenu', { clientX: 10, clientY: 10 }), entries)
    await vi.waitFor(() => expect(document.querySelector('.ctx .v-list-item')).not.toBeNull())
    document.querySelector('.ctx .v-list-item')!.dispatchEvent(new MouseEvent('mouseenter'))
    await vi.waitFor(() => expect(shown()).toEqual(['Maths and Physics']))
    closeContextMenu()
    await vi.waitFor(() => expect(shown()).toEqual([]))
    openContextMenu(new MouseEvent('contextmenu', { clientX: 10, clientY: 10 }), entries)
    await vi.waitFor(() => expect(document.querySelector('.ctx .v-list-item')).not.toBeNull())
    await nextTick()
    expect(shown()).toEqual([])
  })

  it('takes the arrow keys into a menu opened at the pointer, disabled rows included', async () => {
    // Vuetify's next and previous skip an element without an offsetParent, and
    // happy-dom has none at all: a laid-out row's is its positioned ancestor.
    Object.defineProperty(HTMLElement.prototype, 'offsetParent', {
      configurable: true,
      get(this: HTMLElement) {
        return this.parentElement
      },
    })
    onTestFinished(() => {
      delete (HTMLElement.prototype as { offsetParent?: unknown }).offsetParent
    })
    wrapper = mount(WorkspaceMenu, { attachTo: document.body, global: { plugins: [vuetify] } })
    openContextMenu(new MouseEvent('contextmenu', { clientX: 10, clientY: 10 }), [
      { key: 'back', title: 'Back', disabled: true, disabledReason: 'No earlier place.' },
      { key: 'forward', title: 'Forward', disabled: true, disabledReason: 'No later place.' },
      { key: 'r', divider: true },
      { key: 'keys', title: 'Keyboard shortcuts', run: vi.fn() },
    ])
    await vi.waitFor(() => expect(document.querySelectorAll('.ctx .v-list-item')).toHaveLength(3))
    const [back, forward] = [...document.querySelectorAll<HTMLElement>('.ctx .s99ab-disabled-hint--disabled')]
    const keys = [...document.querySelectorAll<HTMLElement>('.ctx .v-list-item')].at(-1)!
    const press = (key: string) => (document.activeElement ?? document.body).dispatchEvent(new KeyboardEvent('keydown', { key, bubbles: true, cancelable: true }))

    expect(document.activeElement).toBe(document.body)
    press('ArrowDown')
    expect(document.activeElement).toBe(back)
    await vi.waitFor(() => expect(document.querySelector('.v-tooltip.v-overlay--active')?.textContent).toContain('No earlier place.'))
    press('ArrowDown')
    expect(document.activeElement).toBe(forward)
    press('ArrowDown')
    expect(document.activeElement).toBe(keys)
    press('Home')
    expect(document.activeElement).toBe(back)
    press('End')
    expect(document.activeElement).toBe(keys)
    expect(useContextMenuState().open).toBe(true)
  })
})

describe('workspace menu focus return', () => {
  /** After the flush that shuts the menu and the task after it, the focus comes back in. */
  const handedBack = async () => {
    await nextTick()
    await new Promise(resolve => setTimeout(resolve))
  }
  const press = (key: string) => (document.activeElement ?? document.body).dispatchEvent(new KeyboardEvent('keydown', { key, bubbles: true, cancelable: true }))

  /** A key that opens the menu, focused and pressed by `by`, the menu then open with one entry. */
  async function openFrom(by: 'pointerdown' | 'keydown', run = vi.fn()) {
    const key = document.createElement('button')
    document.body.append(key)
    onTestFinished(() => key.remove())
    key.focus()
    key.dispatchEvent(new Event(by, { bubbles: true }))
    wrapper = mount(WorkspaceMenu, { attachTo: document.body, global: { plugins: [vuetify] } })
    openContextMenu(new MouseEvent('contextmenu', { clientX: 10, clientY: 10 }), [{ key: 'room', title: 'New room', run }])
    await vi.waitFor(() => expect(document.querySelector('.ctx .v-list-item')).not.toBeNull())
    return key
  }

  // WebKit rings whatever holds the focus at a keydown, so an Escape rings a key
  // clicked open that never lost the focus.
  it('takes the ring an Escape left on a key clicked open', async () => {
    const key = await openFrom('pointerdown')
    vi.spyOn(key, 'matches').mockImplementation(selector => selector === ':focus-visible')
    const blur = vi.spyOn(key, 'blur')
    const focus = vi.spyOn(key, 'focus')
    press('Escape')
    closeContextMenu()
    await nextTick()
    await nextTick()
    expect(focus).not.toHaveBeenCalled()

    await handedBack()
    expect(blur).toHaveBeenCalledOnce()
    expect(focus).toHaveBeenLastCalledWith({ preventScroll: true, focusVisible: false })
    expect(document.activeElement).toBe(key)
  })

  it('leaves the ring on a key opened from the keyboard', async () => {
    const key = await openFrom('keydown')
    vi.spyOn(key, 'matches').mockImplementation(selector => selector === ':focus-visible')
    const blur = vi.spyOn(key, 'blur')
    const focus = vi.spyOn(key, 'focus')
    press('Escape')
    closeContextMenu()
    await handedBack()
    expect(blur).not.toHaveBeenCalled()
    expect(focus).not.toHaveBeenCalled()
    expect(document.activeElement).toBe(key)
  })

  // The arrows take the focus into the menu; Escape gives it back to the key.
  it('gives the focus back with its ring after the keyboard moved into the menu', async () => {
    const key = await openFrom('pointerdown')
    press('ArrowDown')
    expect(document.querySelector('.ctx')!.contains(document.activeElement)).toBe(true)
    const focus = vi.spyOn(key, 'focus')
    press('Escape')
    closeContextMenu()
    ;(document.activeElement as HTMLElement).blur()
    await handedBack()
    expect(focus).toHaveBeenLastCalledWith({ preventScroll: true, focusVisible: true })
    expect(document.activeElement).toBe(key)
  })

  // A dialog the entry opens records what has the focus as what gets it back.
  it('gives the focus back before a clicked entry runs, without the ring', async () => {
    let held: Element | null = null
    const key = await openFrom('pointerdown', vi.fn(() => (held = document.activeElement)))
    const row = document.querySelector<HTMLElement>('.ctx .v-list-item')!
    row.dispatchEvent(new Event('pointerdown', { bubbles: true }))
    row.focus()
    const focus = vi.spyOn(key, 'focus')
    row.click()
    expect(held).toBe(key)
    expect(focus).toHaveBeenCalledWith({ preventScroll: true, focusVisible: false })
  })

  it('leaves the focus where a click elsewhere put it', async () => {
    const key = await openFrom('pointerdown')
    const elsewhere = document.createElement('button')
    document.body.append(elsewhere)
    onTestFinished(() => elsewhere.remove())
    elsewhere.focus()
    closeContextMenu()
    await handedBack()
    expect(document.activeElement).toBe(elsewhere)
    expect(key).not.toBe(document.activeElement)
  })

  // A press on nothing focusable drops the focus on the page; Vuetify too
  // gives no focus back after a click outside.
  it('gives no focus back after a click outside on nothing focusable', async () => {
    const key = await openFrom('pointerdown')
    const focus = vi.spyOn(key, 'focus')
    wrapper!.findComponent(components.VOverlay).vm.$emit('click:outside', new MouseEvent('click'))
    key.blur()
    closeContextMenu()
    await handedBack()
    expect(focus).not.toHaveBeenCalled()
  })
})
