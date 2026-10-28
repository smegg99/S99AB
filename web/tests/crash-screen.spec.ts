// web/tests/crash-screen.spec.ts

import { mount, flushPromises } from '@vue/test-utils'
import { describe, expect, it, vi } from 'vitest'
import CrashScreen from '../src/components/state/CrashScreen.vue'
import type { CrashScreenActions, CrashScreenReport } from '../src/components/state/crashScreen'
import { fakeI18n } from './fake-i18n'
import { vuetify } from './mount'

// Without a message the screen falls back to its English text, so the tests read real sentences.
function mountScreen(report: CrashScreenReport, actions?: CrashScreenActions, message?: string) {
  return mount(CrashScreen, {
    props: { report, actions, message },
    global: { plugins: [vuetify, fakeI18n(k => k)] },
  })
}

const labels = (w: ReturnType<typeof mountScreen>) => w.findAll('button').map(b => b.text())

describe('UiCrashScreen', () => {
  it('names the settings file for a config failure', () => {
    const w = mountScreen({ kind: 'config', app: 'Tuner', file: '/home/u/config.json', error: 'bad key', text: 'report' })

    expect(w.find('h1').text()).toBe('The app could not start')
    expect(w.text()).toContain('The settings file could not be read.')
    expect(w.text()).toContain('File: /home/u/config.json')
    expect(w.find('code').text()).toBe('bad key')
  })

  it('says the app stopped after a crash, with the report open and the window titled', () => {
    const w = mountScreen({ kind: 'crash', app: 'Tuner', version: '1.4.0', text: 'panic: boom' })

    expect(w.find('h1').text()).toBe('The app stopped unexpectedly')
    expect(w.find('pre').text()).toBe('panic: boom')
    expect(w.find('.s99ab-crash__version').text()).toBe('v1.4.0')
    expect(w.emitted('title')).toEqual([['crashed']])
  })

  it('retitles the window when a hung app is closed', async () => {
    const w = mountScreen({ kind: 'hang', app: 'Tuner', alive: true })
    await w.setProps({ report: { kind: 'hang', app: 'Tuner' } })

    expect(w.emitted('title')).toEqual([['not responding'], ['stopped responding']])
  })

  it('takes the app\'s own message over the kind\'s', () => {
    const w = mountScreen({ kind: 'startup', app: 'Tuner' }, undefined, 'The engine could not start in this browser.')

    expect(w.find('.s99ab-crash__text').text()).toBe('The engine could not start in this browser.')
  })

  it('offers only Wait and Close and report while a hung app runs', () => {
    const actions: CrashScreenActions = { wait: vi.fn(), kill: vi.fn(), restart: vi.fn(), close: vi.fn() }
    const w = mountScreen({ kind: 'hang', app: 'Tuner', text: 'r', alive: true }, actions)

    expect(w.find('h1').text()).toBe('The app is not responding')
    expect(labels(w)).toEqual(['Wait', 'Close and report'])
  })

  it('reports a hang that was closed with the full actions', () => {
    const w = mountScreen({ kind: 'hang', app: 'Tuner', text: 'goroutine 1' }, { wait: vi.fn(), restart: vi.fn() })

    expect(w.find('h1').text()).toBe('The app stopped responding')
    expect(w.text()).toContain('Tuner was closed while it was not responding.')
    expect(labels(w)).toEqual(['Copy report', 'Restart'])
  })

  it('names memory when the system killed the app for it', () => {
    const killed = mountScreen({ kind: 'killed', app: 'Tuner' })
    const oom = mountScreen({ kind: 'killed', app: 'Tuner', oom: true })

    expect(killed.find('h1').text()).toBe('The app closed unexpectedly')
    expect(killed.text()).toContain('Tuner was closed before it could report anything.')
    expect(oom.text()).toContain('The system ran out of memory and closed Tuner.')
  })

  it('offers an action only when it can run', () => {
    const actions: CrashScreenActions = {
      save: vi.fn(), email: vi.fn(), openLogs: vi.fn(), restart: vi.fn(), close: vi.fn(),
    }
    const none = mountScreen({ kind: 'startup', app: 'Tuner', text: 'r', email: false, logs: false }, actions)
    expect(labels(none)).toEqual(['Copy report', 'Save report', 'Close', 'Restart'])

    const all = mountScreen({ kind: 'startup', app: 'Tuner', text: 'r', email: true, logs: true }, actions)
    expect(labels(all)).toEqual(['Copy report', 'Save report', 'Email report', 'Show log file', 'Close', 'Restart'])
  })

  it('shows where the report was saved, and why an action failed', async () => {
    const w = mountScreen({ kind: 'startup', app: 'Tuner', text: 'r', email: true }, {
      save: () => Promise.resolve('/home/u/report.txt'),
      email: () => Promise.reject(new Error('no mail client')),
    })

    await w.findAll('button')[1]!.trigger('click')
    await flushPromises()
    expect(w.find('.s99ab-crash__note').text()).toBe('Saved to /home/u/report.txt')

    await w.findAll('button')[2]!.trigger('click')
    await flushPromises()
    expect(w.find('.s99ab-crash__note').text()).toBe('That did not work: no mail client')
  })

  it('marks the copy as done', async () => {
    const w = mountScreen({ kind: 'crash', app: 'Tuner', text: 'r' }, { copy: () => Promise.resolve(true) })

    await w.find('button').trigger('click')
    await flushPromises()
    expect(w.find('button').text()).toBe('Copied')
  })
})
