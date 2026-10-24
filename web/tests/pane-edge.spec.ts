// web/tests/pane-edge.spec.ts
import { afterEach, describe, expect, it } from 'vitest'
import { mount } from '@vue/test-utils'
import PaneEdge from '../src/components/primitives/PaneEdge.vue'

afterEach(() => document.body.replaceChildren())

function setup() {
  const host = document.createElement('div')
  const clip = document.createElement('div')
  host.append(clip)
  document.body.append(host)
  const wrapper = mount(PaneEdge, {
    attachTo: clip,
    attrs: { class: 'edge' },
    props: { host, label: 'Resize pane', width: 216, min: 180, max: 480, reset: 216 },
  })
  const edge = host.querySelector<HTMLElement>('[role="separator"]')!
  return { host, clip, wrapper, edge }
}

const move = (x: number, buttons = 1) => window.dispatchEvent(new PointerEvent('pointermove', { pointerId: 7, clientX: x, buttons }))
const press = (edge: HTMLElement) => edge.dispatchEvent(new PointerEvent('pointerdown', { pointerId: 7, button: 0, clientX: 216, bubbles: true, cancelable: true }))

describe('collapsible pane edge', () => {
  it('mounts outside the clipped pane, carries caller classes and stops tracking when disposed', () => {
    const { host, clip, wrapper, edge } = setup()
    expect(edge.parentElement).toBe(host)
    expect(clip.contains(edge)).toBe(false)
    expect(edge.classList.contains('edge')).toBe(true)
    expect(edge.getAttribute('aria-label')).toBe('Resize pane')
    press(edge)
    move(256)
    expect(wrapper.emitted('update:width')?.at(-1)).toEqual([256])
    wrapper.unmount()
    const count = wrapper.emitted('update:width')?.length
    move(280)
    expect(wrapper.emitted('update:width')?.length).toBe(count)
  })

  it('folds without losing its remembered width and requires the unfold threshold to open again', async () => {
    const { wrapper, edge } = setup()
    press(edge)
    move(80)
    expect(wrapper.props('width')).toBe(216)
    expect(wrapper.emitted('update:collapsed')?.at(-1)).toEqual([true])
    await wrapper.setProps({ collapsed: true })
    move(110)
    expect(wrapper.emitted('update:collapsed')).toHaveLength(1)
    move(140)
    expect(wrapper.emitted('update:collapsed')?.at(-1)).toEqual([false])
    expect(wrapper.emitted('update:width')?.at(-1)).toEqual([180])
    wrapper.unmount()
  })

  it('keeps modified arrows for application shortcuts and clamps ordinary resize keys', async () => {
    const { wrapper, edge } = setup()
    edge.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowRight', altKey: true }))
    expect(wrapper.emitted('update:width')).toBeUndefined()
    edge.dispatchEvent(new KeyboardEvent('keydown', { key: 'End' }))
    expect(wrapper.emitted('update:width')?.at(-1)).toEqual([480])
    await wrapper.setProps({ width: 180 })
    edge.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowLeft' }))
    expect(wrapper.emitted('update:width')?.at(-1)).toEqual([180])
    edge.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter' }))
    expect(wrapper.emitted('update:collapsed')?.at(-1)).toEqual([true])
    wrapper.unmount()
  })
})
