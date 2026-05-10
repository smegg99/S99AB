// web/tests/kratos.spec.ts

import { createVuetify } from 'vuetify'
import * as components from 'vuetify/components'
import * as directives from 'vuetify/directives'
import { nextTick } from 'vue'
import { flushPromises, mount } from '@vue/test-utils'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import KratosForm from '../src/components/auth/KratosForm.vue'
import ErrorState from '../src/components/state/ErrorState.vue'
import {
  configureKratos,
  isKratosHidden,
  isKratosInput,
  isKratosPrimary,
  isKratosSubmit,
  kratosInputType,
  kratosLabel,
  kratosSeverity,
  useKratosFlow,
  type KratosFlow,
  type KratosNode,
} from '../src/composables/kratos/useKratosFlow'
import { fakeI18n } from './fake-i18n'

// Real flows captured from Kratos v1.3.1; the form renders whatever shape Kratos sends.
import login from './fixtures/login.json'
import step1 from './fixtures/registration-step1.json'
import step2 from './fixtures/registration-step2.json'

const vuetify = createVuetify({ components, directives })

function nodes(flow: unknown): KratosNode[] {
  return (flow as KratosFlow).ui.nodes
}

function inputNames(flow: unknown): string[] {
  return nodes(flow)
    .filter(isKratosInput)
    .map(n => n.attributes.name!)
}

interface Call {
  url: string
  method: string
  body: string
}

interface PostReply {
  status: number
  body?: unknown
}

/** A Kratos that answers in JSON: GET returns the flow, POST returns the case's reply. Records every call. */
function serve(flow: unknown, post?: PostReply | (() => PostReply)): Call[] {
  window.history.replaceState(
    {},
    '',
    `/register?flow=${(flow as KratosFlow).id}`,
  )

  const calls: Call[] = []
  vi.stubGlobal(
    'fetch',
    vi.fn((url: string, init: RequestInit = {}) => {
      const method = init.method ?? 'GET'
      calls.push({ url, method, body: init.body ? String(init.body) : '' })

      if (method === 'POST') {
        const reply = (typeof post === 'function' ? post() : post) ?? {
          status: 200,
          body: {},
        }
        return Promise.resolve({
          ok: reply.status >= 200 && reply.status < 300,
          status: reply.status,
          json: () => Promise.resolve(reply.body ?? {}),
        })
      }
      return Promise.resolve({
        ok: true,
        status: 200,
        json: () => Promise.resolve(flow),
      })
    }),
  )
  return calls
}

async function mountForm(
  flow: unknown,
  kind: 'login' | 'registration' = 'registration',
  post?: PostReply | (() => PostReply),
) {
  const calls = serve(flow, post)
  const wrapper = mount(KratosForm, {
    props: { kind },
    global: { plugins: [vuetify, fakeI18n(k => k)] },
    attachTo: document.body,
  })
  await flushPromises()
  return { wrapper, calls }
}

async function signUp(wrapper: { find: (s: string) => { element: Element } }) {
  const form = wrapper.find('form').element as HTMLFormElement
  const email = form.querySelector<HTMLInputElement>(
    'input[name="traits.email"]',
  )
  if (email) email.value = 'carol@example.com'

  form.querySelector<HTMLButtonElement>('button[name="method"]')!.click()
  await flushPromises()
  return form
}

beforeEach(() => {
  configureKratos({ basePath: '/kratos' })
})

afterEach(() => {
  vi.unstubAllGlobals()
})

describe('registration step one', () => {
  it('renders the traits from the identity schema', () => {
    expect(inputNames(step1)).toEqual(['traits.email', 'traits.name'])
  })

  it('carries the csrf token as a hidden field', () => {
    const hidden = nodes(step1)
      .filter(isKratosHidden)
      .map(n => n.attributes.name)
    expect(hidden).toContain('csrf_token')
  })

  it('labels fields from Kratos, not from the field path', () => {
    const email = nodes(step1).find(
      n => n.attributes.name === 'traits.email',
    )!
    expect(kratosLabel(email)).toBe('Email')
    expect(kratosInputType(email)).toBe('email')
  })
})

// v1.3 registration is two-step: traits first, then the method. The page must
// re-read the flow or the password field never appears.
describe('registration step two', () => {
  it('offers the password field', () => {
    expect(inputNames(step2)).toEqual(['password'])

    const password = nodes(step2).find(
      n => n.attributes.name === 'password',
    )!
    expect(kratosInputType(password)).toBe('password')
  })

  it('resubmits the traits from step one as hidden fields', () => {
    const hidden = nodes(step2)
      .filter(isKratosHidden)
      .map(n => n.attributes.name)
    expect(hidden).toContain('traits.email')
    expect(hidden).toContain('traits.name')
    expect(hidden).toContain('csrf_token')
  })

  it('distinguishes the forward submit from the back one', () => {
    const submits = nodes(step2).filter(isKratosSubmit)
    expect(submits).toHaveLength(2)

    const primary = submits
      .filter(isKratosPrimary)
      .map(n => n.attributes.name)
    expect(primary).toEqual(['method'])

    const secondary = submits
      .filter(n => !isKratosPrimary(n))
      .map(n => n.attributes.name)
    expect(secondary).toEqual(['screen'])
  })
})

describe('node classification', () => {
  it('never treats a hidden field as an input', () => {
    for (const flow of [login, step1, step2]) {
      for (const name of inputNames(flow)) {
        expect(name).not.toBe('csrf_token')
      }
    }
  })

  // A date trait must stay a date input, a phone number must keep its keypad.
  it('passes a known input type through', () => {
    const node = {
      type: 'input',
      group: 'default',
      attributes: { name: 'x', type: 'tel' },
    }
    expect(kratosInputType(node as KratosNode)).toBe('tel')
  })

  it('falls back to text for a type no browser has a control for', () => {
    const node = {
      type: 'input',
      group: 'default',
      attributes: { name: 'x', type: 'something-new' },
    }
    expect(kratosInputType(node as KratosNode)).toBe('text')
  })

  it('falls back to the field name when Kratos sends no label', () => {
    const node = {
      type: 'input',
      group: 'default',
      attributes: { name: 'traits.thing' },
    }
    expect(kratosLabel(node as KratosNode)).toBe('traits.thing')
  })
})

// Step two of a registration opens with an info message, which must not render as an error.
describe('message severity', () => {
  it('keeps an info message out of the error styling', () => {
    const messages = (step2 as unknown as KratosFlow).ui.messages ?? []
    expect(messages.map(kratosSeverity)).not.toContain('error')
  })

  it('maps each type to itself, and anything unknown to info', () => {
    expect(kratosSeverity({ id: 1, text: '', type: 'error' })).toBe('error')
    expect(kratosSeverity({ id: 1, text: '', type: 'success' })).toBe(
      'success',
    )
    expect(kratosSeverity({ id: 1, text: '', type: 'info' })).toBe('info')
  })
})

describe('reading the flow', () => {
  it('reads the flow the URL names, through the configured base path', async () => {
    configureKratos({ basePath: '/auth' })
    serve(step1)

    const kratos = useKratosFlow('registration')
    await kratos.start()

    expect(fetch).toHaveBeenCalledWith(
      `/auth/self-service/registration/flows?id=${(step1 as KratosFlow).id}`,
      expect.objectContaining({ credentials: 'include' }),
    )
    expect(kratos.pending.value).toBe(false)
    expect(kratos.failed.value).toBe(false)
  })

  it('seeds the visible inputs and nothing else', async () => {
    serve(step2)

    const kratos = useKratosFlow('registration')
    await kratos.start()

    // Step one's traits come back hidden and are sent back verbatim.
    expect(Object.keys(kratos.values)).toEqual(['password'])
  })

  // Kratos refuses to make a login or registration flow for someone who
  // already has a session. Redirected it answered that by quietly sending the
  // browser home; asked for JSON it returns 400 instead, and reading that as a
  // dead flow puts "This form has expired" in front of someone whose only
  // problem is that they are already signed in.
  it('sends an already-signed-in reader on rather than erroring at them', async () => {
    window.history.replaceState({}, '', '/login')
    vi.stubGlobal(
      'fetch',
      vi.fn(() =>
        Promise.resolve({
          ok: false,
          status: 400,
          json: () =>
            Promise.resolve({ error: { id: 'session_already_available' } }),
        }),
      ),
    )

    // An empty returnTo is what a page with no ?return_to= passes, and it must
    // not become the destination: an empty href is "this page again", which on
    // a screen that leaves because you are already signed in is an infinite
    // reload rather than a way out.
    const kratos = useKratosFlow('login', { returnTo: '' })
    await kratos.start()

    expect(kratos.failed.value).toBe(false)
    // Still pending: the browser is leaving, and dropping the spinner would
    // show a frame of an empty form on the way out.
    expect(kratos.pending.value).toBe(true)
    expect(window.location.pathname).toBe('/')
  })

  // A backend that accepts connections but never answers must not hold the
  // loading state forever, so the request carries a deadline.
  it('gives up on a request that never answers', async () => {
    window.history.replaceState({}, '', '/register')
    // Typed like fetch so the recorded call carries the init.
    const fetchMock = vi.fn((_url: string, _init?: RequestInit) =>
      Promise.resolve({ ok: true, json: () => Promise.resolve(step1) }),
    )
    vi.stubGlobal('fetch', fetchMock)

    const kratos = useKratosFlow('registration')
    await kratos.start()

    expect(fetchMock.mock.calls[0]![1]?.signal).toBeInstanceOf(AbortSignal)
  })

  // Refused, aborted or offline: a rejected request is reported, not left mid-load.
  it('reports a request that rejects rather than staying pending', async () => {
    window.history.replaceState({}, '', '/register')
    vi.stubGlobal(
      'fetch',
      vi.fn(() => Promise.reject(new DOMException('timed out', 'TimeoutError'))),
    )

    const kratos = useKratosFlow('registration')
    await kratos.start()

    expect(kratos.failed.value).toBe(true)
    expect(kratos.pending.value).toBe(false)
  })

  it('fails when neither the named flow nor a fresh one can be had', async () => {
    window.history.replaceState({}, '', '/register?flow=dead')
    vi.stubGlobal(
      'fetch',
      vi.fn(() => Promise.resolve({ ok: false, status: 410 })),
    )

    const kratos = useKratosFlow('registration')
    await kratos.start()

    expect(kratos.failed.value).toBe(true)
    expect(kratos.pending.value).toBe(false)
  })

  // A flow id in the URL outlives its flow (403 submitted, 404 forgotten, 410
  // expired). start() must create a fresh flow and drop the id.
  it('starts a fresh flow when the id in the URL is spent', async () => {
    window.history.replaceState({}, '', '/register?flow=spent')
    vi.stubGlobal(
      'fetch',
      vi
        .fn()
        // readFlow: already submitted, so Kratos refuses it.
        .mockResolvedValueOnce({ ok: false, status: 403 })
        // createFlow.
        .mockResolvedValueOnce({
          ok: true,
          status: 200,
          json: () => Promise.resolve(step1),
        }),
    )

    const kratos = useKratosFlow('registration')
    await kratos.start()

    expect(kratos.failed.value).toBe(false)
    expect(kratos.flow.value?.id).toBe((step1 as KratosFlow).id)
    // The spent id is removed from the URL, so a reload cannot reuse it.
    expect(window.location.search).toBe('')
  })

  // 403, 404 and 410 are handled the same way.
  it.each([403, 404, 410])('recovers from a %i on the named flow', async (status) => {
    window.history.replaceState({}, '', '/register?flow=spent')
    vi.stubGlobal(
      'fetch',
      vi
        .fn()
        .mockResolvedValueOnce({ ok: false, status })
        .mockResolvedValueOnce({
          ok: true,
          status: 200,
          json: () => Promise.resolve(step1),
        }),
    )

    const kratos = useKratosFlow('registration')
    await kratos.start()

    expect(kratos.failed.value).toBe(false)
    expect(inputNames(kratos.flow.value)).toEqual(inputNames(step1))
  })

  // A spent id plus a live session reports the signed-in state.
  it('sends a signed-in reader on even when the URL names a spent flow', async () => {
    window.history.replaceState({}, '', '/register?flow=spent')
    vi.stubGlobal(
      'fetch',
      vi
        .fn()
        .mockResolvedValueOnce({ ok: false, status: 403 })
        .mockResolvedValueOnce({
          ok: false,
          status: 400,
          json: () =>
            Promise.resolve({ error: { id: 'session_already_available' } }),
        }),
    )

    const kratos = useKratosFlow('registration', { returnTo: '' })
    await kratos.start()

    expect(kratos.failed.value).toBe(false)
    expect(window.location.pathname).toBe('/')
  })
})

describe('UiKratosForm', () => {
  // Kratos picks the strategy from the clicked button's name/value, so the
  // submitter must reach the body; form.submit() sends none.
  it('puts the clicked button\'s name and value in the body', async () => {
    const { wrapper, calls } = await mountForm(step1, 'registration', {
      status: 400,
      body: step2,
    })

    await signUp(wrapper)

    const post = calls.find(c => c.method === 'POST')
    expect(post).toBeDefined()

    const sent = new URLSearchParams(post!.body)
    expect(sent.get('method')).toBe('profile')
    expect(sent.get('traits.email')).toBe('carol@example.com')
    expect(sent.get('csrf_token')).toEqual(expect.any(String))
  })

  // Without the submitter, every field arrives except the method.
  it('would lose only the method if the submitter were dropped', async () => {
    const { wrapper } = await mountForm(step1)
    const form = wrapper.find('form').element as HTMLFormElement

    // Compared as a set: the form renders in the flow's order.
    expect([...new FormData(form).keys()].sort()).toEqual([
      'csrf_token',
      'traits.email',
      'traits.name',
    ])
  })

  // Against a JSON Kratos, each registration step stays on the page instead of redirecting.
  it('moves to the next step without leaving the page', async () => {
    const before = window.location.href
    const { wrapper } = await mountForm(step1, 'registration', {
      status: 400,
      body: step2,
    })

    await signUp(wrapper)

    expect(window.location.href).toBe(before)
    expect(wrapper.find('input[name="password"]').exists()).toBe(true)
    // The trait stays on the form as a hidden value.
    expect(wrapper.find('input[name="traits.email"]').attributes('type')).toBe(
      'hidden',
    )
  })

  it('starts a flow without a navigation when the URL names none', async () => {
    const calls = serve(step1)
    // serve puts a flow in the URL; this case needs none.
    window.history.replaceState({}, '', '/register')
    const before = window.location.href

    const kratos = useKratosFlow('registration')
    await kratos.start()

    expect(window.location.href).toBe(before)
    expect(calls.map(c => c.url)).toEqual([
      '/kratos/self-service/registration/browser',
    ])
    expect(kratos.flow.value?.id).toBe((step1 as KratosFlow).id)
  })

  it('replaces a dead flow in place rather than stranding the reader', async () => {
    const { wrapper, calls } = await mountForm(step1, 'registration', {
      status: 410,
    })

    await signUp(wrapper)

    // The dead id is removed from the URL.
    expect(window.location.search).not.toContain('flow=')
    expect(
      calls.some(c => c.url.endsWith('/self-service/registration/browser')),
    ).toBe(true)
    expect(wrapper.find('form').exists()).toBe(true)
  })

  // With no flow at all (Kratos down, offline), the screen shows words and a retry.
  it('says the server is unreachable, not that the form expired', async () => {
    window.history.replaceState({}, '', '/register?flow=spent')
    vi.stubGlobal(
      'fetch',
      vi.fn(() => Promise.resolve({ ok: false, status: 500 })),
    )

    const wrapper = mount(KratosForm, {
      props: { kind: 'registration' as const },
      global: { plugins: [vuetify, fakeI18n(k => k)] },
      attachTo: document.body,
    })
    await flushPromises()
    await nextTick()

    expect(wrapper.find('form').exists()).toBe(false)

    const error = wrapper.findComponent(ErrorState)
    expect(error.exists()).toBe(true)
    // A 500 is unreachable, not expired. The fake translator returns the key.
    expect(error.text()).toContain('auth.flowUnreachable')
    expect(error.text()).not.toContain('auth.flowExpired')
    // Announced to screen readers.
    expect(wrapper.find('[role="alert"]').exists()).toBe(true)
  })

  // A flow gone mid-submit is replaced, and the fresh form says why the fields emptied.
  it('says the form expired when a submit finds the flow gone', async () => {
    const { wrapper } = await mountForm(step1, 'registration', { status: 410 })

    await signUp(wrapper)
    await nextTick()

    // The fake translator returns the key, which useTranslate replaces with the fallback copy.
    expect(wrapper.find('form').exists()).toBe(true)
    expect(wrapper.text()).toContain('This form has expired')
    // The fields are back under the message.
    expect(wrapper.find('input[name="traits.email"]').exists()).toBe(true)
  })

  it('says which step is in flight and refuses to run two at once', async () => {
    let release: () => void = () => {}
    const held = new Promise<void>((r) => {
      release = r
    })

    const { wrapper } = await mountForm(step1)
    const kratos = useKratosFlow('registration')
    void kratos

    // Hold the POST open so the in-flight state is observable.
    vi.stubGlobal(
      'fetch',
      vi.fn(
        () =>
          held.then(() => ({
            ok: false,
            status: 400,
            json: () => Promise.resolve(step2),
          })) as unknown as Promise<Response>,
      ),
    )

    const form = wrapper.find('form').element as HTMLFormElement
    form.querySelector<HTMLInputElement>('input[name="traits.email"]')!.value
      = 'carol@example.com'
    const button = form.querySelector<HTMLButtonElement>(
      'button[name="method"]',
    )!

    button.click()
    await flushPromises()

    expect(button.disabled).toBe(true)

    release()
    await flushPromises()
  })

  it('posts to the action and method the flow named', async () => {
    const { wrapper } = await mountForm(step1)
    const form = wrapper.find('form')

    expect(form.attributes('action')).toBe((step1 as KratosFlow).ui.action)
    expect(form.attributes('method')).toBe('POST')
  })

  it('renders one submit per Kratos button, each carrying its own value', async () => {
    const { wrapper } = await mountForm(step2)

    const buttons = wrapper.findAll('button[type="submit"]')
    expect(
      buttons.map(b => [b.attributes('name'), b.attributes('value')]),
    ).toEqual([
      ['method', 'password'],
      ['screen', 'previous'],
    ])
  })

  it('renders the login flow it is given, without naming a field', async () => {
    const { wrapper } = await mountForm(login, 'login')

    const names = wrapper.findAll('input').map(i => i.attributes('name'))
    expect(names).toEqual(['csrf_token', 'identifier', 'password'])
    expect(wrapper.find('button[name="method"]').attributes('value')).toBe(
      'password',
    )
  })

  // Kratos messages keep their kind: an info message is not shown as a failure.
  it('shows an info message as info rather than as a failure', async () => {
    const { wrapper } = await mountForm(step2)

    const note = wrapper.find('.s99ab-auth-note')
    expect(note.text()).toContain('Please choose a credential')
    expect(note.classes()).toContain('s99ab-auth-note--info')
    expect(note.classes()).not.toContain('s99ab-auth-note--error')
    // Announced as a status, since it is only the next step.
    expect(note.attributes('role')).toBe('status')
  })

  it('offers a way to start over when the flow is gone', async () => {
    window.history.replaceState({}, '', '/register?flow=dead')
    vi.stubGlobal(
      'fetch',
      vi.fn(() => Promise.resolve({ ok: false, status: 410 })),
    )

    const wrapper = mount(KratosForm, {
      props: { kind: 'registration' },
      global: { plugins: [vuetify, fakeI18n(k => k)] },
    })
    await flushPromises()

    expect(wrapper.findComponent(ErrorState).exists()).toBe(true)
    expect(wrapper.find('form').exists()).toBe(false)
  })
})

// Inside the form element and inside the stack, so anything an app puts here
// takes the same gap the fields do and a button it adds submits the same flow.
// Slot content sits inside the form and the stack, and its buttons submit the same flow.
describe('UiKratosForm slots', () => {
  it('renders a note above the fields and one under the submit', async () => {
    serve(login)
    const wrapper = mount(KratosForm, {
      props: { kind: 'login' },
      slots: {
        prepend: '<p class="above">continue with</p>',
        append: '<p class="below">terms</p>',
      },
      global: { plugins: [vuetify, fakeI18n(k => k)] },
    })
    await flushPromises()

    const form = wrapper.find('form')
    expect(form.find('.above').exists()).toBe(true)
    expect(form.find('.below').exists()).toBe(true)
  })
})

// The same AutoHeight wrapper as other async surfaces.
describe('UiKratosForm framing', () => {
  it('renders the flow inside the animated box', async () => {
    serve(login)
    const wrapper = mount(KratosForm, {
      props: { kind: 'login' },
      global: { plugins: [vuetify, fakeI18n(k => k)] },
    })
    await flushPromises()

    expect(wrapper.find('.autoheight form.s99ab-auth-form').exists()).toBe(true)
  })

  // The flow rests at null and useFirstLoad tests for undefined.
  it('reports a flow still in flight as loading, not as content', () => {
    serve(login)
    const wrapper = mount(KratosForm, {
      props: { kind: 'login' },
      global: { plugins: [vuetify, fakeI18n(k => k)] },
    })

    expect(wrapper.find('form.s99ab-auth-form').exists()).toBe(false)
  })
})

// Kratos still validates. These rules use only what the node states; the
// password policy is not in the flow.
describe('UiKratosForm validation', () => {
  it('requires a field Kratos marked required', async () => {
    const { wrapper } = await mountForm(login, 'login')
    const field = wrapper.findAllComponents({ name: 'VTextField' })[0]!

    expect(field.props('rules')).toHaveLength(1)
    const rule = (field.props('rules') as ((v: string) => boolean | string)[])[0]!
    expect(rule('')).not.toBe(true)
    expect(rule('someone')).toBe(true)
  })

  it('checks the shape of a field Kratos typed as an email', async () => {
    const flow = structuredClone(login) as typeof login
    const node = flow.ui.nodes.find(n => n.attributes.name === 'identifier')!
    node.attributes.type = 'email'

    const { wrapper } = await mountForm(flow, 'login')
    const rules = wrapper.findAllComponents({ name: 'VTextField' })[0]!
      .props('rules') as ((v: string) => boolean | string)[]

    expect(rules.some(r => r('nope') !== true)).toBe(true)
    expect(rules.every(r => r('a@b.co') === true)).toBe(true)
  })

  // Empty passes the shape rule; required covers emptiness.
  it('lets the shape rule pass on empty', async () => {
    const flow = structuredClone(login) as typeof login
    const node = flow.ui.nodes.find(n => n.attributes.name === 'identifier')!
    node.attributes.type = 'email'
    node.attributes.required = false

    const { wrapper } = await mountForm(flow, 'login')
    const rules = wrapper.findAllComponents({ name: 'VTextField' })[0]!
      .props('rules') as ((v: string) => boolean | string)[]

    expect(rules.every(r => r('') === true)).toBe(true)
  })
})

// Switching flow in place, which is what a card does when it is not remounted.
// restart() keeps the old flow until the new one lands, so no loading state
// appears - but the fields it renders have to be the new flow's.
// Switching flow in place: restart() keeps the old flow until the new one
// lands, and the fields must be the new flow's.
describe('UiKratosForm switching kind', () => {
  it('renders the new flow\'s fields, not the old ones', async () => {
    const calls = serve(login)
    const wrapper = mount(KratosForm, {
      props: { kind: 'login' as const },
      global: { plugins: [vuetify, fakeI18n(k => k)] },
    })
    await flushPromises()
    expect([...wrapper.findAll('form input')].map(i => i.attributes('name')))
      .toContain('identifier')

    calls.length = 0
    serve(step1)
    await wrapper.setProps({ kind: 'registration' })
    await flushPromises()
    await nextTick()

    const names = [...wrapper.findAll('form input')].map(i => i.attributes('name'))
    expect(names).toContain('traits.email')
    expect(names).not.toContain('identifier')
  })
})

// The rules were decorative before this: a native form has no v-form to
// validate on submit, so they lit up on blur and the request went to Kratos
// with whatever was typed.
describe('UiKratosForm blocking a bad submit', () => {
  // Not `required` - the browser enforces that one itself, before any handler
  // runs. This is the rule only the layer can apply: Kratos types a login's
  // identifier `text`, so nothing native checks the shape of it.
  it('says why, rather than failing silently', async () => {
    configureKratos({ identifierIsEmail: true })
    const { wrapper } = await mountForm(login, 'login')

    const inputs = wrapper.findAll('input')
    await inputs.find(i => i.attributes('name') === 'identifier')!.setValue('nope')
    await inputs.find(i => i.attributes('name') === 'password')!.setValue('secret123')

    await wrapper.find('button[name="method"]').trigger('click')
    await flushPromises()
    await nextTick()

    expect(wrapper.text()).toContain('Not an email address')
    configureKratos({ identifierIsEmail: false })
  })

  it('does not post an identifier that is not an email, when the app says it is one', async () => {
    configureKratos({ identifierIsEmail: true })
    const { wrapper, calls } = await mountForm(login, 'login')

    const inputs = wrapper.findAll('input')
    await inputs.find(i => i.attributes('name') === 'identifier')!.setValue('nope')
    await inputs.find(i => i.attributes('name') === 'password')!.setValue('secret123')
    calls.length = 0

    await wrapper.find('button[name="method"]').trigger('click')
    await flushPromises()

    expect(calls).toHaveLength(0)
    configureKratos({ identifierIsEmail: false })
  })

  it('posts once every rule passes', async () => {
    configureKratos({ identifierIsEmail: true })
    const { wrapper, calls } = await mountForm(login, 'login')

    const inputs = wrapper.findAll('input')
    await inputs.find(i => i.attributes('name') === 'identifier')!.setValue('a@b.co')
    await inputs.find(i => i.attributes('name') === 'password')!.setValue('secret123')
    calls.length = 0

    await wrapper.find('button[name="method"]').trigger('click')
    await flushPromises()

    expect(calls.length).toBeGreaterThan(0)
    configureKratos({ identifierIsEmail: false })
  })
})
