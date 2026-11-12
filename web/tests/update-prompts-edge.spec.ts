// web/tests/update-prompts-edge.spec.ts
import { flushPromises } from '@vue/test-utils'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { closeDialog, dialogEntries } from '../src/internal/dialog'
import { cleanupPrompts, fakeSource, mountPrompts, visibility } from './update-prompts-helpers'

beforeEach(() => visibility('visible'))
afterEach(cleanupPrompts)

describe('update prompt lifecycle', () => {
  it('rechecks visibility after the state request completes', async () => {
    const fake = fakeSource()
    let resolve!: (value: Awaited<ReturnType<typeof fake.source.state>>) => void
    fake.source.state.mockImplementationOnce(() => new Promise((done) => {
      resolve = done
    }))
    mountPrompts(fake.source)
    visibility('hidden')
    resolve({ current: '1.4.3', update: { version: '1.5.0' } })
    await flushPromises()
    expect(dialogEntries).toHaveLength(0)
    visibility('visible')
    await flushPromises()
    expect(dialogEntries).toHaveLength(1)
  })

  it('resolves notes again if the language changes while loading', async () => {
    const fake = fakeSource({ current: '1.5.0', notes: { version: '1.5.0', text: 'Polish notes', lang: 'pl' } })
    let resolve!: (value: Awaited<ReturnType<typeof fake.source.state>>) => void
    fake.source.state.mockImplementationOnce(() => new Promise((done) => {
      resolve = done
    }))
    const { i18n } = mountPrompts(fake.source)
    i18n.global.locale.value = 'pl'
    resolve({ current: '1.5.0', notes: { version: '1.5.0', text: 'English notes', lang: 'en' } })
    await flushPromises()
    expect(fake.source.state).toHaveBeenLastCalledWith('pl')
    expect(dialogEntries[0]!.props.notesLocale).toBe('pl')
  })

  it('defers the update if the page hides while notes are open', async () => {
    const fake = fakeSource({ current: '1.4.3', notes: { version: '1.4.3', text: 'Fixed.', lang: 'en' }, update: { version: '1.5.0' } })
    mountPrompts(fake.source)
    await flushPromises()
    visibility('hidden')
    closeDialog(dialogEntries[0]!.id)
    await flushPromises()
    expect(fake.source.notesShown).toHaveBeenCalledOnce()
    expect(dialogEntries).toHaveLength(0)
    visibility('visible')
    await flushPromises()
    expect(dialogEntries[0]!.props.latest).toBe('1.5.0')
  })

  it('queues a newer version without opening overlapping prompts', async () => {
    const fake = fakeSource()
    mountPrompts(fake.source)
    await flushPromises()
    fake.setState({ current: '1.4.3', update: { version: '1.5.1' } })
    fake.available('1.5.1')
    expect(dialogEntries).toHaveLength(1)
    closeDialog(dialogEntries[0]!.id, 'later')
    await flushPromises()
    expect(dialogEntries).toHaveLength(1)
    expect(dialogEntries[0]!.props.latest).toBe('1.5.1')
  })

  it('swallows action failures and does not repeat handled notes', async () => {
    const fake = fakeSource({ current: '1.4.3', notes: { version: '1.4.3', text: 'Fixed.', lang: 'en' }, update: { version: '1.5.0' } })
    fake.source.notesShown.mockRejectedValue(new Error('store unavailable'))
    fake.source.download.mockRejectedValue(new Error('browser unavailable'))
    mountPrompts(fake.source)
    await flushPromises()
    closeDialog(dialogEntries[0]!.id)
    await flushPromises()
    closeDialog(dialogEntries[0]!.id, 'download')
    await flushPromises()
    fake.available()
    await flushPromises()
    expect(fake.source.download).toHaveBeenCalledOnce()
    expect(fake.source.notesShown).toHaveBeenCalledOnce()
    expect(dialogEntries).toHaveLength(0)
  })

  it('unsubscribes and closes its dialog on disposal', async () => {
    const fake = fakeSource()
    const { wrapper } = mountPrompts(fake.source)
    await flushPromises()
    wrapper.unmount()
    fake.available()
    visibility('visible')
    await flushPromises()
    expect(fake.unsubscribe).toHaveBeenCalledOnce()
    expect(fake.source.state).toHaveBeenCalledOnce()
    expect(dialogEntries).toHaveLength(0)
  })
})
