// web/tests/toast-host.spec.ts

import { readFileSync } from 'node:fs'
import { createRequire } from 'node:module'
import { resolve } from 'node:path'
import { createVuetify } from 'vuetify'
import * as components from 'vuetify/components'
import * as directives from 'vuetify/directives'
import { nextTick } from 'vue'
import { mount } from '@vue/test-utils'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import ToastHost from '../src/components/overlay/ToastHost.vue'
import { configureMotion } from '../src/composables/motion/internal/motion'
import { configureToast } from '../src/composables/toast/internal/config'
import { resetToasts, visibleAt } from '../src/composables/toast/internal/queue'
import { stackLift } from '../src/composables/toast/internal/stack'
import { useToast } from '../src/composables/toast/useToast'

const vuetify = createVuetify({ components, directives })

function mountHost() {
  return mount(ToastHost, { global: { plugins: [vuetify] } })
}

// happy-dom has no tab to background, so the flag and its event are set by hand.
function hidden(is: boolean) {
  Object.defineProperty(document, 'hidden', { configurable: true, value: is })
  document.dispatchEvent(new Event('visibilitychange'))
}

describe('UiToastHost', () => {
  beforeEach(() => {
    resetToasts()
    configureToast({
      progress: 'bottom',
      maxVisible: 3,
      dedupeWindow: 1000,
      icon: true,
      closable: true,
    })
    configureMotion({ level: 'full' })
  })
  afterEach(() => resetToasts())

  // Every position keeps its container even when empty, so the last toast's
  // leave transition can run before Vue unmounts the subtree.
  it('keeps a container for every position, so a leaving toast has one to leave', async () => {
    const toast = useToast()
    const wrapper = mountHost()

    expect(wrapper.findAll('.s99ab-toasts')).toHaveLength(6)

    toast.info('hello', { position: 'top-end' })
    await nextTick()

    const filled = wrapper.findAll('.s99ab-toasts').filter(s => s.findAll('.s99ab-toast').length > 0)
    expect(filled).toHaveLength(1)
    expect(filled[0]!.classes()).toContain('s99ab-toasts--top-end')

    toast.dismiss(toast.queues['top-end'][0]!.id)
    await nextTick()
    expect(wrapper.findAll('.s99ab-toasts')).toHaveLength(6)
  })

  it('carries the kind as a class, so the icon, count and bar share one colour', async () => {
    const toast = useToast()
    const wrapper = mountHost()

    toast.error('nope')
    await nextTick()

    expect(wrapper.find('.s99ab-toast').classes()).toContain('s99ab-toast--error')
  })

  // A count of one is not a repeat.
  it('shows the repeat count only once there is a repeat', async () => {
    const toast = useToast()
    const wrapper = mountHost()

    toast.error('Save failed')
    await nextTick()
    expect(wrapper.find('.s99ab-toast__count').exists()).toBe(false)

    toast.error('Save failed')
    toast.error('Save failed')
    await nextTick()
    // A bare number in the kind's colour at the end of the row.
    const marker = wrapper.find('.s99ab-toast__count')
    expect(marker.text()).toBe('3')
    expect(marker.attributes('aria-label')).toContain('3')
  })

  describe('lifespan', () => {
    it('draws the bar for the toast\'s own timeout', async () => {
      const toast = useToast()
      const wrapper = mountHost()

      toast.info('timed', { timeout: 4000 })
      await nextTick()

      const bar = wrapper.find('.s99ab-toast__life')
      expect(bar.exists()).toBe(true)
      expect(bar.attributes('style')).toContain('4000ms')
    })

    // Nothing to count down, so no bar.
    it('draws none for a sticky toast', async () => {
      const toast = useToast()
      const wrapper = mountHost()

      toast.error('waits for you', { timeout: 0 })
      await nextTick()

      expect(wrapper.find('.s99ab-toast__life').exists()).toBe(false)
    })

    it('draws none when the app has turned it off', async () => {
      configureToast({ progress: 'none' })
      const toast = useToast()
      const wrapper = mountHost()

      toast.info('timed', { timeout: 4000 })
      await nextTick()

      expect(wrapper.find('.s99ab-toast__life').exists()).toBe(false)
    })

    it('puts the bar on the edge the app asked for', async () => {
      configureToast({ progress: 'top' })
      const toast = useToast()
      const wrapper = mountHost()

      toast.info('timed', { timeout: 4000 })
      await nextTick()

      expect(wrapper.find('.s99ab-toast').classes()).toContain('s99ab-toast--life-top')
    })

    // Motion off clamps the CSS animation, so the bar would show empty while the toast stays.
    it('draws none with motion off, rather than an empty bar', async () => {
      configureMotion({ level: 'off' })
      const toast = useToast()
      const wrapper = mountHost()

      toast.info('timed', { timeout: 4000 })
      await nextTick()

      expect(wrapper.find('.s99ab-toast__life').exists()).toBe(false)
    })

    // With pause-on-hover off, a toast leaves on time under the pointer.
    it('leaves the countdown alone on hover when the app has turned that off', async () => {
      configureToast({ pauseOnHover: false })
      const toast = useToast()
      const wrapper = mountHost()

      toast.info('timed', { timeout: 4000 })
      await nextTick()

      const item = wrapper.find('.s99ab-toast')
      await item.trigger('pointerenter')
      expect(wrapper.find('.s99ab-toast').classes()).not.toContain('s99ab-toast--held')

      configureToast({ pauseOnHover: true })
    })

    // No countdown runs in a background tab, so the answer is still there on return.
    it('holds every countdown while the tab is in the background', async () => {
      vi.useFakeTimers()
      const toast = useToast()
      const wrapper = mountHost()

      try {
        toast.info('timed', { timeout: 1000 })
        await nextTick()

        hidden(true)
        vi.advanceTimersByTime(60_000)
        expect(visibleAt('bottom-end')).toHaveLength(1)

        hidden(false)
        vi.advanceTimersByTime(1000)
        expect(visibleAt('bottom-end')).toHaveLength(0)
      }
      finally {
        wrapper.unmount()
        hidden(false)
        vi.useRealTimers()
      }
    })

    // The countdown and the bar stop on the same event.
    it('holds the bar while the pointer is over the toast', async () => {
      const toast = useToast()
      const wrapper = mountHost()

      toast.info('timed', { timeout: 4000 })
      await nextTick()

      const item = wrapper.find('.s99ab-toast')
      expect(item.classes()).not.toContain('s99ab-toast--held')

      await item.trigger('pointerenter')
      expect(wrapper.find('.s99ab-toast').classes()).toContain('s99ab-toast--held')

      await item.trigger('pointerleave')
      expect(wrapper.find('.s99ab-toast').classes()).not.toContain('s99ab-toast--held')
    })
  })

  describe('the trailing cluster', () => {
    // The action sits beside the close, not on its own row.
    it('puts the action in the same cluster as the close', async () => {
      const toast = useToast()
      const wrapper = mountHost()

      toast.warning('Archived', { action: { label: 'Undo', icon: 'mdi-undo', onClick: () => {} } })
      await nextTick()

      const cluster = wrapper.find('.s99ab-toast__end')
      expect(cluster.find('.s99ab-toast__action').exists()).toBe(true)
      expect(cluster.find('.s99ab-toast__close').exists()).toBe(true)
    })

    // An icon saves width; the label becomes its accessible name.
    it('renders an action with an icon as an icon button', async () => {
      const toast = useToast()
      const wrapper = mountHost()

      toast.warning('Archived', { action: { label: 'Undo', icon: 'mdi-undo', onClick: () => {} } })
      await nextTick()

      const action = wrapper.find('.s99ab-toast__action')
      expect(action.classes()).toContain('v-btn--icon')
      expect(action.attributes('aria-label')).toBe('Undo')
    })

    it('falls back to the label when an action has no icon', async () => {
      const toast = useToast()
      const wrapper = mountHost()

      toast.warning('Archived', { action: { label: 'Undo', onClick: () => {} } })
      await nextTick()

      const action = wrapper.find('.s99ab-toast__action')
      expect(action.classes()).not.toContain('v-btn--icon')
      expect(action.text()).toBe('Undo')
    })

    it('runs the action and dismisses the toast', async () => {
      let ran = 0
      const toast = useToast()
      const wrapper = mountHost()

      toast.warning('Archived', { action: { label: 'Undo', icon: 'mdi-undo', onClick: () => ran++ } })
      await nextTick()
      await wrapper.find('.s99ab-toast__action').trigger('click')

      expect(ran).toBe(1)
      expect(wrapper.findAll('.s99ab-toast')).toHaveLength(0)
    })
  })

  describe('what each toast may override', () => {
    it('takes a per-toast lifespan over the app default', async () => {
      const toast = useToast()
      const wrapper = mountHost()

      toast.info('timed', { timeout: 4000, progress: 'top' })
      await nextTick()

      expect(wrapper.find('.s99ab-toast').classes()).toContain('s99ab-toast--life-top')
    })

    it('takes a per-toast icon, and drops it for false', async () => {
      const toast = useToast()
      const wrapper = mountHost()

      toast.info('custom', { icon: 'mdi-rocket' })
      toast.info('none', { icon: false, dedupe: false })
      await nextTick()

      // Found by text: a bottom stack draws newest first.
      const items = wrapper.findAll('.s99ab-toast')
      const custom = items.find(i => i.text().includes('custom'))!
      const none = items.find(i => i.text().includes('none'))!

      expect(custom.find('.s99ab-toast__icon').exists()).toBe(true)
      expect(none.find('.s99ab-toast__icon').exists()).toBe(false)
    })

    it('drops the kind glyph for every toast when the app asks', async () => {
      configureToast({ icon: false })
      const toast = useToast()
      const wrapper = mountHost()

      toast.info('bare')
      await nextTick()

      expect(wrapper.find('.s99ab-toast__icon').exists()).toBe(false)
    })

    it('drops the close button when the app asks', async () => {
      configureToast({ closable: false })
      const toast = useToast()
      const wrapper = mountHost()

      toast.info('timed', { timeout: 4000 })
      await nextTick()

      expect(wrapper.find('.s99ab-toast__close').exists()).toBe(false)
    })

    // Otherwise a global closable: false would leave sticky toasts on screen until reload.
    it('keeps the close button when nothing else could dismiss it', async () => {
      configureToast({ closable: false })
      const toast = useToast()
      const wrapper = mountHost()

      toast.error('sticky', { timeout: 0 })
      await nextTick()

      expect(wrapper.find('.s99ab-toast__close').exists()).toBe(true)
    })
  })

  // Newest nearest the pinned edge, so the oldest leaves from the far end.
  describe('order', () => {
    it('draws the newest first in a bottom stack', async () => {
      const toast = useToast()
      const wrapper = mountHost()

      toast.info('first', { position: 'bottom-end' })
      toast.info('second', { position: 'bottom-end' })
      await nextTick()

      const texts = wrapper.findAll('.s99ab-toast').map(t => t.text())
      expect(texts[0]).toContain('second')
      expect(texts[1]).toContain('first')
    })

    it('draws the newest first in a top stack too', async () => {
      const toast = useToast()
      const wrapper = mountHost()

      toast.info('first', { position: 'top-end' })
      toast.info('second', { position: 'top-end' })
      await nextTick()

      const texts = wrapper.findAll('.s99ab-toast').map(t => t.text())
      expect(texts[0]).toContain('second')
      expect(texts[1]).toContain('first')
    })

    // The toast nearest the edge paints in front, so an arrival slides in over the stack.
    it('paints the nearest the edge in front', async () => {
      const toast = useToast()
      const wrapper = mountHost()

      toast.info('first')
      toast.info('second')
      await nextTick()

      const slots = wrapper.findAll('.s99ab-toast-slot')
      expect(slots[0]!.attributes('style')).toContain('z-index: 2')
      expect(slots[1]!.attributes('style')).toContain('z-index: 1')
    })
  })

  // A toast is placed by the toasts nearer the edge, so one leaving cannot move another.
  describe('placement', () => {
    it('sits the toast nearest the edge flat against it', async () => {
      const toast = useToast()
      const wrapper = mountHost()

      toast.info('nearest')
      await nextTick()

      expect(wrapper.find('.s99ab-toast').attributes('style'))
        .toContain('--s99ab-toast-lift: calc(0px + 0 * var(--s99ab-toast-gap))')
    })

    // happy-dom lays nothing out, so heights are 0; this checks the gap per toast crossed.
    it('lifts each further toast clear of the ones nearer the edge', async () => {
      const toast = useToast()
      const wrapper = mountHost()

      toast.info('first')
      toast.info('second')
      await nextTick()

      const lifts = wrapper.findAll('.s99ab-toast').map(t => t.attributes('style'))
      expect(lifts[0]).toContain('0 * var(--s99ab-toast-gap)')
      expect(lifts[1]).toContain('1 * var(--s99ab-toast-gap)')
    })

    // A toast's place depends only on toasts nearer the edge. Checked on the
    // placement function, since happy-dom has no heights.
    it('gives a toast a place that depends only on what is nearer the edge', () => {
      const heights = [48, 64, 40]

      expect(stackLift(heights, 1)).toBe(stackLift(heights.slice(0, 2), 1))
      expect(stackLift(heights, 2)).toBe('calc(112px + 2 * var(--s99ab-toast-gap))')
    })
  })

  it('says how many are still waiting past maxVisible', async () => {
    configureToast({ maxVisible: 2 })
    const toast = useToast()
    const wrapper = mountHost()

    for (let i = 0; i < 5; i++) toast.info(`m${i}`, { dedupe: false })
    await nextTick()

    expect(wrapper.findAll('.s99ab-toast')).toHaveLength(2)
    expect(wrapper.find('.s99ab-toasts__more').text()).toBe('+3')
  })

  // Errors interrupt; anything else waits its turn.
  it('escalates the live region when the stack holds an error', async () => {
    const toast = useToast()
    const wrapper = mountHost()
    // The default position.
    const stack = () => wrapper.find('.s99ab-toasts--bottom-end')

    toast.info('fine')
    await nextTick()
    expect(stack().attributes('aria-live')).toBe('polite')

    toast.error('not fine')
    await nextTick()
    expect(stack().attributes('aria-live')).toBe('assertive')
  })
})

// -------------------------------------------------------------- placing ----

// Stack placement lives in the stylesheet. The top stack must clear the app bar,
// since $toast-z puts it above every layout item.
describe('toast stack placement', () => {
  const sheet = readFileSync(resolve(process.cwd(), 'src/styles/_toasts.scss'), 'utf8')

  /** The declarations of one stack's rule. */
  function rule(position: string): string {
    const match = sheet.match(new RegExp(`\\.s99ab-toasts--${position}\\s*\\{([^}]*)\\}`))
    return match?.[1] ?? ''
  }

  it.each(['top-start', 'top', 'top-end'])('clears the app bar at %s', (position) => {
    expect(rule(position)).toContain('inset-block-start: var(--s99ab-toast-top)')
  })

  it.each(['bottom-start', 'bottom', 'bottom-end'])('sits on the window edge at %s', (position) => {
    expect(rule(position)).toContain('inset-block-end: var(--s99ab-toast-bottom)')
  })
})

// ---------------------------------------------------------------- layer ----

// This run cannot load Vuetify's CSS, so its z-index defaults are read from the
// installed sources.
describe('toast stack layer', () => {
  const config = readFileSync(resolve(process.cwd(), 'src/styles/_config.scss'), 'utf8')
  const installed = createRequire(import.meta.url)
  const vuetifySource = (path: string) => readFileSync(installed.resolve(`vuetify/lib/${path}`), 'utf8')

  /** The first number pattern captures in source. */
  function number(source: string, pattern: RegExp): number {
    const found = pattern.exec(source)
    if (!found) throw new Error(`no match for ${pattern}; read the source again`)
    return Number(found[1])
  }

  const toast = number(config, /^\$toast-z:\s*(\d+)\s*!default;/m)
  // The first menu or tooltip; every overlay opened over another adds 10.
  const overlay = number(vuetifySource('components/VOverlay/VOverlay.js'), /zIndex:\s*\{\s*type:\s*\[Number, String\],\s*default:\s*(\d+)/)
  const dialog = number(vuetifySource('components/VDialog/VDialog.js'), /zIndex:\s*(\d+)/)

  it('stands under the first menu or tooltip, so under every overlay and dialog', () => {
    expect(toast).toBeLessThan(overlay)
    expect(toast).toBeLessThan(dialog)
  })

  it('stands over Vuetify\'s layout, which starts at 1000', () => {
    expect(toast).toBeGreaterThan(number(vuetifySource('composables/layout.js'), /ROOT_ZINDEX = (\d+)/))
  })
})
