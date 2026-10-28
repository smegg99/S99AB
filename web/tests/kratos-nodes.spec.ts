// web/tests/kratos-nodes.spec.ts

import { mount } from '@vue/test-utils'
import { describe, expect, it, vi } from 'vitest'
import KratosNode from '../src/components/auth/KratosNode.vue'
import { kratosInputType, kratosNodeKind } from '../src/composables/kratos/internal/nodes'
import type { KratosNode as Node } from '../src/composables/kratos/internal/types'
import { vuetify } from './mount'

function node(partial: Partial<Node> & { type: string }): Node {
  return { group: 'default', attributes: {}, ...partial } as Node
}

function render(n: Node, props: Record<string, unknown> = {}) {
  return mount(KratosNode, {
    props: { node: n, ...props } as never,
    global: { plugins: [vuetify] },
  })
}

// Every node shape Kratos can send is named; an unknown node leaves a flow that cannot be finished.
describe('kratosNodeKind', () => {
  it('names every node type Kratos sends', () => {
    expect(kratosNodeKind(node({ type: 'input', attributes: { type: 'hidden' } }))).toBe('hidden')
    expect(kratosNodeKind(node({ type: 'input', attributes: { type: 'text' } }))).toBe('field')
    expect(kratosNodeKind(node({ type: 'input', attributes: { type: 'password' } }))).toBe('field')
    expect(kratosNodeKind(node({ type: 'input', attributes: { type: 'checkbox' } }))).toBe('checkbox')
    expect(kratosNodeKind(node({ type: 'input', attributes: { type: 'submit' } }))).toBe('submit')
    expect(kratosNodeKind(node({ type: 'input', attributes: { type: 'button' } }))).toBe('button')
    expect(kratosNodeKind(node({ type: 'img' }))).toBe('image')
    expect(kratosNodeKind(node({ type: 'text' }))).toBe('text')
    expect(kratosNodeKind(node({ type: 'a' }))).toBe('anchor')
    expect(kratosNodeKind(node({ type: 'script' }))).toBe('script')
  })

  it('names anything it does not know rather than mistaking it for a field', () => {
    expect(kratosNodeKind(node({ type: 'something-new' }))).toBe('unknown')
  })

  // Date and checkbox inputs keep their type.
  it('passes an input type through rather than collapsing it to text', () => {
    for (const type of ['email', 'password', 'number', 'tel', 'url', 'date']) {
      expect(kratosInputType(node({ type: 'input', attributes: { type } }))).toBe(type)
    }
    expect(kratosInputType(node({ type: 'input', attributes: { type: 'nonsense' } }))).toBe('text')
  })
})

describe('UiKratosNode', () => {
  it('explains a server-disabled field and removes the extra focus stop when enabled', async () => {
    const field = node({
      type: 'input',
      attributes: { name: 'identifier', type: 'text', disabled: true },
      meta: { label: { text: 'Email' } },
    })
    const w = render(field, { errors: ['This identity cannot sign in.'] })
    const hint = w.find('.s99ab-disabled-hint')
    expect(hint.attributes('tabindex')).toBe('0')
    expect(hint.attributes('aria-label')).toBe('Email')
    expect(w.find('input').attributes('disabled')).toBeDefined()
    expect(w.findComponent({ name: 'VTooltip' }).props('text')).toBe('This identity cannot sign in.')
    await w.setProps({ node: { ...field, attributes: { ...field.attributes, disabled: false } }, errors: [] })
    expect(hint.attributes('tabindex')).toBeUndefined()
    expect(w.find('input').attributes('disabled')).toBeUndefined()
    w.unmount()
  })

  it('explains pending submission without replacing the native disabled state', async () => {
    const w = render(node({ type: 'input', attributes: { name: 'method', type: 'submit', value: 'password' } }), { submitting: true })
    expect(w.find('button').attributes('disabled')).toBeDefined()
    expect(w.findComponent({ name: 'VTooltip' }).props('text')).toBe('auth.pending')
    await w.setProps({ submitting: false })
    expect(w.find('button').attributes('disabled')).toBeUndefined()
    expect(w.find('.s99ab-disabled-hint').attributes('tabindex')).toBeUndefined()
    w.unmount()
  })

  it('renders a boolean trait as a checkbox, not a text box', async () => {
    const w = render(node({
      type: 'input',
      group: 'profile',
      attributes: { name: 'traits.terms', type: 'checkbox' },
      meta: { label: { text: 'I accept the terms' } },
    }))

    expect(w.find('input[type="checkbox"]').exists()).toBe(true)
    expect(w.find('input[type="text"]').exists()).toBe(false)

    // Kratos sends and expects a boolean's state as the string value.
    await w.find('input[type="checkbox"]').setValue(true)
    expect(w.emitted('update:value')).toEqual([['true']])
  })

  // The TOTP setup screen is only a QR code.
  it('renders the TOTP QR code', () => {
    const w = render(node({
      type: 'img',
      group: 'totp',
      attributes: { src: 'data:image/png;base64,iVBORw0KGgo=', width: 256, height: 256 },
      meta: { label: { text: 'Authenticator QR' } },
    }))

    const img = w.find('img')
    expect(img.attributes('src')).toContain('data:image/png')
    expect(img.attributes('alt')).toBe('Authenticator QR')
  })

  // Recovery codes are shown once, as text to copy.
  it('renders recovery codes as text to copy', () => {
    const w = render(node({
      type: 'text',
      group: 'lookup_secret',
      attributes: { text: { text: 'abcd-1234\nefgh-5678' } },
    }))

    expect(w.find('.s99ab-auth-node__text').text()).toContain('abcd-1234')
  })

  // A button node runs Kratos's onclick (a WebAuthn ceremony) instead of posting the form.
  it('renders a button node as a button, not a submit', async () => {
    const n = node({
      type: 'input',
      group: 'webauthn',
      attributes: {
        name: 'webauthn_login_trigger',
        type: 'button',
        onclick: 'window.oryWebAuthnLogin()',
      },
      meta: { label: { text: 'Use security key' } },
    })
    const w = render(n)

    expect(w.find('button').attributes('type')).toBe('button')
    await w.find('button').trigger('click')
    expect(w.emitted('run')).toHaveLength(1)
  })

  it('renders a submit as a submit', () => {
    const w = render(node({
      type: 'input',
      group: 'password',
      attributes: { name: 'method', type: 'submit', value: 'password' },
      meta: { label: { text: 'Sign in' } },
    }))

    expect(w.find('button').attributes('type')).toBe('submit')
  })

  // Script nodes are declined and reported, since injecting a remote script is what CSP prevents.
  it('declines a script node out loud', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})
    const w = render(node({ type: 'script', group: 'webauthn', attributes: { src: '/x.js' } }))

    expect(w.emitted('unsupported')).toHaveLength(1)
    expect(warn).toHaveBeenCalled()
    warn.mockRestore()
  })

  // An unrenderable node is reported instead of silently dropped.
  it('reports a node it cannot render rather than dropping it', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})
    const w = render(node({ type: 'something-new', group: 'future' }))

    expect(w.emitted('unsupported')).toHaveLength(1)
    expect(warn.mock.calls[0]?.[0]).toContain('something-new')
    warn.mockRestore()
  })
})

// Kratos links ("resend the code", "back to sign in") render as layer controls.
describe('an anchor node', () => {
  it('is a text button rather than a browser-default link', () => {
    const wrapper = render(node({
      type: 'a',
      attributes: { href: 'https://example.test/recover', title: { text: 'Recover' } },
    }))

    const button = wrapper.find('a.v-btn')
    expect(button.exists()).toBe(true)
    expect(button.attributes('href')).toBe('https://example.test/recover')
    expect(button.classes()).toContain('v-btn--variant-text')
    expect(wrapper.text()).toContain('Recover')
  })
})
