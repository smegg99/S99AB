// web/tests/auth-ui.spec.ts

import { h } from 'vue'
import { mount } from '@vue/test-utils'
import { beforeEach, describe, expect, it } from 'vitest'
import { createVuetify } from 'vuetify'
import * as components from 'vuetify/components'
import * as directives from 'vuetify/directives'
import AuthCard from '../src/components/auth/AuthCard.vue'
import AuthPage from '../src/components/auth/AuthPage.vue'
import { configureAuthPaths } from '../src/composables/kratos/internal/paths'
import { fakeI18n } from './fake-i18n'

const vuetify = createVuetify({ components, directives })

// The form is stubbed: it starts a Kratos flow on mount. useTranslate falls back
// to the layer's English, so these assert words.
const stubs = { UiKratosForm: { template: '<form class="stub-form" />' } }

function mountCard(props: Record<string, unknown> = {}, slots: Record<string, unknown> = {}) {
  return mount(AuthCard, {
    props: props as never,
    slots: slots as never,
    global: { plugins: [vuetify, fakeI18n(k => k)], stubs },
  })
}

function mountPage(props: Record<string, unknown> = {}, slots: Record<string, unknown> = {}) {
  return mount(AuthPage, {
    props: props as never,
    slots: slots as never,
    global: { plugins: [vuetify, fakeI18n(k => k)], stubs },
  })
}

beforeEach(() => {
  configureAuthPaths({ signInPath: '/sign-in', signUpPath: '/sign-up', homePath: '/' })
})

describe('UiAuthCard', () => {
  it('heads the card by the flow it is running', () => {
    expect(mountCard().text()).toContain('Sign in')
    expect(mountCard({ kind: 'registration' }).text()).toContain('Create account')
  })

  // The other flow is offered only where the app routes it.
  it('offers the other flow only where the app routes it', () => {
    expect(mountCard().text()).toContain('No account yet?')

    configureAuthPaths({ signInPath: '/sign-in', signUpPath: '' })
    expect(mountCard().text()).not.toContain('No account yet?')
  })

  // Unrouted, it emits so the dialog's caller keeps its work.
  it('emits rather than navigates when it is not routed', async () => {
    const w = mountCard({ routed: false })

    await w.find('.s99ab-auth__switch button').trigger('click')
    expect(w.emitted('switch')).toEqual([['registration']])
    expect(w.find('.s99ab-auth__switch a').exists()).toBe(false)
  })
})

describe('UiAuthPage', () => {
  // The signed-out screen stands on UiBackdrop like every other screen.
  it('stands on the same washed ground as every other screen', () => {
    expect(mountPage().find('.s99ab-backdrop').exists()).toBe(true)
  })

  it('lets a screen that brings its own ground turn it off', () => {
    expect(mountPage({ backdrop: false }).find('.s99ab-backdrop').exists()).toBe(false)
  })

  // The app's name is the card's head strip.
  it('names the app in the card head, beside the flow', () => {
    const w = mountPage({ title: 'Bin' })

    const head = w.find('.panel__head')
    expect(head.text()).toContain('Bin')
    expect(head.text()).toContain('Sign in')
    expect(w.find('.stub-form').exists()).toBe(true)
  })

  // With no app name the head would say "Sign in" twice.
  it('does not say the flow twice when there is no app name', () => {
    const head = mountPage().find('.panel__head')

    expect(head.text().match(/Sign in/g)).toHaveLength(1)
  })

  // The build goes in the card foot.
  it('puts the build in the card foot', () => {
    const w = mountPage({ title: 'Bin', version: '1.0.0' })

    expect(w.find('.panel__foot .s99ab-auth__plate').text()).toContain('1.0.0')
  })

  // A dev build has no build info, so the plate is absent.
  it('leaves the plate off when there is no build to name', () => {
    expect(mountPage({ title: 'Bin' }).find('.s99ab-auth__plate').exists()).toBe(false)
  })

  it('shows only the build fields it was given', () => {
    const w = mountPage({ title: 'Bin', version: '1.0.0', commit: 'a1b2c3d' })
    const plate = w.find('.s99ab-auth__plate')

    expect(plate.text()).toContain('1.0.0')
    expect(plate.text()).toContain('a1b2c3d')
    expect(plate.text()).not.toContain('built')
  })

  it('lets an app put its own markings in the corner', () => {
    const w = mountPage({ title: 'Bin' }, { plate: () => h('span', 'staging') })

    expect(w.find('.s99ab-auth__plate').text()).toBe('staging')
  })
})

// The mark sits above the card, outside it.
describe('UiAuthPage branding', () => {
  it('draws the layer mark above the card by default', () => {
    const w = mountPage({ title: 'Bin' })

    expect(w.find('.s99ab-auth__mark svg.mark').exists()).toBe(true)
  })

  it('lets an app put its own mark there, replacing the layer\'s', () => {
    const w = mountPage({ title: 'Bin' }, {
      brand: () => h('img', { class: 'mine', src: '/logo.svg' }),
    })

    expect(w.find('.mine').exists()).toBe(true)
    expect(w.find('svg.mark').exists()).toBe(false)
  })

  it('draws nothing above the card when branding is off', () => {
    expect(mountPage({ title: 'Bin', brand: false }).find('.s99ab-auth__mark').exists())
      .toBe(false)
  })

  // A card used inside an already-branded screen does not get the mark.
  it('keeps the mark out of the card', () => {
    expect(mountCard({ appName: 'Bin' }).find('svg.mark').exists()).toBe(false)
  })

  it('keeps the app name and the flow name in the head', () => {
    const w = mountCard({ appName: 'Bin' })

    expect(w.find('.panel__head .panel__title').text()).toBe('Bin')
    expect(w.find('.panel__head .panel__meta').text()).toBe('Sign in')
  })
})

// Pinned to the viewport; this screen has no app bar.
describe('UiAuthPage controls', () => {
  it('offers a light/dark and a contrast button in the corner', () => {
    const w = mountPage({ title: 'Bin' })

    expect(w.findAll('.s99ab-auth__controls .v-btn')).toHaveLength(2)
  })

  it('drops either one on its own', () => {
    expect(mountPage({ title: 'Bin', contrast: false })
      .findAll('.s99ab-auth__controls .v-btn')).toHaveLength(1)
    expect(mountPage({ title: 'Bin', theme: false, contrast: false })
      .find('.s99ab-auth__controls').exists()).toBe(false)
  })

  it('lets an app put its own controls there', () => {
    const w = mountPage({ title: 'Bin' }, {
      controls: () => h('button', { class: 'mine' }, 'x'),
    })

    expect(w.find('.s99ab-auth__controls .mine').exists()).toBe(true)
    expect(w.find('.s99ab-auth__controls .v-btn').exists()).toBe(false)
  })
})

// Slots are asserted through UiAuthPage, since the forwarding is what is tested.
describe('UiAuthPage slots', () => {
  it('forwards only the slots it was actually given', () => {
    // Passing a function for every forwarded name would make the card's $slots
    // checks true and draw an empty build plate.
    const w = mountPage({ title: 'Bin' }, { brand: () => h('span', 'x') })

    expect(w.find('.s99ab-auth__plate').exists()).toBe(false)
  })

  it('puts a note above and below the form', () => {
    const w = mountPage({ title: 'Bin' }, {
      prepend: () => h('p', { class: 'above' }, 'sso'),
      append: () => h('p', { class: 'below' }, 'terms'),
    })

    expect(w.find('.panel__body .above').exists()).toBe(true)
    expect(w.find('.panel__body .below').exists()).toBe(true)
  })

  // The source link sits past the plate's hairlines.
  it('puts its own control at the trailing edge of the foot', () => {
    const w = mountPage({ title: 'Bin', version: '1.0.0' }, {
      'plate-end': () => h('a', { class: 'repo-link' }, 'source'),
    })

    expect(w.find('.panel__foot .repo-link').exists()).toBe(true)
  })

  // UiRepoStat runs a query, so it is off by default and Pinia is not required.
  it('draws no repository readout unless the app asks for one', () => {
    const w = mountPage({ title: 'Bin', version: '1.0.0' })

    expect(w.find('.repo').exists()).toBe(false)
  })
})

// The only link out of signing in; the screen has no bar or rail.
describe('UiAuthPage way out', () => {
  it('offers the way home in the opposite corner to the controls', () => {
    const w = mountPage({ title: 'Bin' })

    expect(w.find('.s99ab-auth__out .v-btn').exists()).toBe(true)
  })

  // Without a homePath there is nowhere to link.
  it('withholds it when no homePath is configured', () => {
    configureAuthPaths({ homePath: '' })

    expect(mountPage({ title: 'Bin' }).find('.s99ab-auth__out').exists()).toBe(false)
  })

  it('drops it on a screen reached from nowhere', () => {
    expect(mountPage({ title: 'Bin', home: false }).find('.s99ab-auth__out').exists())
      .toBe(false)
  })

  it('takes the app\'s own wording', () => {
    const w = mountPage({ title: 'Bin', homeLabel: 'Back to Bin' })

    expect(w.find('.s99ab-auth__out').text()).toBe('Back to Bin')
  })

  // App markup counts as a way out even with no path configured.
  it('lets an app replace it, path or no path', () => {
    configureAuthPaths({ homePath: '' })
    const w = mountPage({ title: 'Bin' }, { home: () => h('a', { class: 'mine' }, 'out') })

    expect(w.find('.s99ab-auth__out .mine').exists()).toBe(true)
  })
})
