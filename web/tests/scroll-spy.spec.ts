// web/tests/scroll-spy.spec.ts

import { defineComponent, h, nextTick } from 'vue'
import { mount } from '@vue/test-utils'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { useScrollSpy } from '../src/composables/shell/useScrollSpy'
import { anchorsIn } from '../src/composables/shell/internal/anchors'

// Lights the section being read on an anchor-only nav, where the URL only knows the clicked row.

/** The region, with sections at fixed distances down it. */
function page(sections: Array<[id: string, top: number]>, height = 4000) {
  const main = document.createElement('div')
  main.className = 'shell__main'
  main.getBoundingClientRect = (() => ({ top: 0 })) as typeof main.getBoundingClientRect
  Object.defineProperty(main, 'scrollTop', { value: 0, writable: true })
  Object.defineProperty(main, 'scrollHeight', { value: height, writable: true })
  Object.defineProperty(main, 'clientHeight', { value: 800, writable: true })

  for (const [id, top] of sections) {
    const el = document.createElement('div')
    el.id = id
    // Fixed in page space; the rect subtracts the region's scroll, as a real one does.
    el.getBoundingClientRect = (() => ({
      top: top - (main as unknown as { scrollTop: number }).scrollTop,
    })) as typeof el.getBoundingClientRect
    document.body.append(el)
  }

  document.body.append(main)
  return main
}

/** Moves the region and lets the spy's own frame-coalescing catch up. */
async function scrollTo(main: HTMLElement, top: number) {
  ;(main as unknown as { scrollTop: number }).scrollTop = top
  main.dispatchEvent(new Event('scroll'))
  await vi.advanceTimersByTimeAsync(40)
}

/** Runs the spy inside a mounted component, as a real call site is. */
function spyOn(ids: string[]) {
  let out!: ReturnType<typeof useScrollSpy>
  mount(defineComponent({
    setup() {
      out = useScrollSpy(() => ids)
      return () => h('div')
    },
  }))
  return out
}

beforeEach(() => {
  vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout', 'requestAnimationFrame', 'cancelAnimationFrame', 'Date'] })
  document.body.innerHTML = ''
})

afterEach(async () => {
  await vi.runAllTimersAsync()
  vi.useRealTimers()
})

describe('which section is being read', () => {
  it('names nothing above the first one', async () => {
    const main = page([['a', 500], ['b', 1500], ['c', 2500]])
    const spy = spyOn(['a', 'b', 'c'])
    await nextTick()
    await scrollTo(main, 0)

    expect(spy.current.value).toBe('')
  })

  // The last section whose top has passed, since several are always on screen.
  it('follows the reader down the page', async () => {
    const main = page([['a', 500], ['b', 1500], ['c', 2500]])
    const spy = spyOn(['a', 'b', 'c'])
    await nextTick()

    await scrollTo(main, 600)
    expect(spy.current.value).toBe('a')

    await scrollTo(main, 1600)
    expect(spy.current.value).toBe('b')

    await scrollTo(main, 2600)
    expect(spy.current.value).toBe('c')
  })

  it('follows it back up again', async () => {
    const main = page([['a', 500], ['b', 1500], ['c', 2500]])
    const spy = spyOn(['a', 'b', 'c'])
    await nextTick()

    await scrollTo(main, 2600)
    await scrollTo(main, 700)

    expect(spy.current.value).toBe('a')
  })

  // A short final section never reaches the region's top, so the bottom of the page names it.
  it('names the last section at the bottom of the page', async () => {
    const main = page([['a', 500], ['b', 1500], ['tail', 3900]], 4000)
    const spy = spyOn(['a', 'b', 'tail'])
    await nextTick()

    await scrollTo(main, 3200)

    expect(spy.current.value).toBe('tail')
  })

  // Measured from the same line scrollBehavior lands on: the top of the area the
  // padded chrome does not cover.
  it('counts a section reached only once it clears the padded chrome', async () => {
    const main = page([['a', 500], ['b', 1500]])
    main.style.paddingTop = '44px'
    const spy = spyOn(['a', 'b'])
    await nextTick()

    // Where scrollBehavior lands `b`: its offset less the region's bar padding.
    const landing = 1500 - 44

    await scrollTo(main, landing - 16)
    expect(spy.current.value).toBe('a')

    await scrollTo(main, landing)
    expect(spy.current.value).toBe('b')
  })

  it('says nothing when the page has no sections', async () => {
    const main = page([])
    const spy = spyOn([])
    await nextTick()
    await scrollTo(main, 400)

    expect(spy.current.value).toBe('')
  })

  // The region renders after the nav, so it does not exist at the spy's setup.
  it('attaches to a region that mounts after it does', async () => {
    const spy = spyOn(['a', 'b'])
    await nextTick()

    const main = page([['a', 500], ['b', 1500]])
    await scrollTo(main, 1600)

    expect(spy.current.value).toBe('b')
  })

  // An unmounted spy stops looking for its region before it reads the page
  // again, since the document may be gone with it.
  it('stops looking for its region once it is unmounted, never reading the page again', async () => {
    const wrapper = mount(defineComponent({
      setup() {
        useScrollSpy(() => ['a'])
        return () => h('div')
      },
    }))
    await nextTick()
    const look = vi.spyOn(document, 'querySelector')
    wrapper.unmount()
    await vi.advanceTimersByTimeAsync(80)
    expect(look).not.toHaveBeenCalledWith('.shell__main')
    look.mockRestore()
  })
})

describe('what may write the URL', () => {
  // Only scrolling updates the anchor. Navigation already set it, and a pending
  // or failed scroll would otherwise read as the top and erase it.
  it('leaves an anchor alone when nothing has scrolled', async () => {
    const main = page([['a', 500], ['b', 1500]])
    const spy = spyOn(['a', 'b'])
    await nextTick()
    await vi.advanceTimersByTimeAsync(60)

    // Read at the top without a scroll event: the value is taken, the URL untouched.
    expect(spy.current.value).toBe('')
    expect(main.scrollTop).toBe(0)
  })
})

describe('which rows are sections at all', () => {
  // A row pointing at another page's section is not part of this page's spy.
  it('takes only the anchors on the page being read', () => {
    const tos = ['/', '/theme', '/theme#spacing', '/theme#type', '/textures#grain', '/panels']

    expect(anchorsIn(tos, '/theme')).toEqual(['spacing', 'type'])
    expect(anchorsIn(tos, '/textures')).toEqual(['grain'])
    expect(anchorsIn(tos, '/panels')).toEqual([])
  })

  it('keeps them in the order they are drawn, without repeats', () => {
    const tos = ['/theme#b', '/theme#a', '/theme#b']

    expect(anchorsIn(tos, '/theme')).toEqual(['b', 'a'])
  })

  it('ignores a bare hash, which names no element', () => {
    expect(anchorsIn(['/theme#'], '/theme')).toEqual([])
  })
})
