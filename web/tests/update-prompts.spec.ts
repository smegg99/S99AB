// web/tests/update-prompts.spec.ts
import { flushPromises } from '@vue/test-utils'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import UiReleaseNotesDialog from '../src/components/releases/ReleaseNotesDialog.vue'
import UiUpdateDialog from '../src/components/releases/UpdateDialog.vue'
import { closeDialog, dialogEntries } from '../src/internal/dialog'
import { cleanupPrompts, fakeSource, mountPrompts, visibility } from './update-prompts-helpers'

beforeEach(() => visibility('visible'))
afterEach(cleanupPrompts)

describe('useUpdatePrompts', () => {
  it('opens the notes before the update', async () => {
    const fake = fakeSource({ current: '1.4.3', notes: { version: '1.4.3', text: 'Fixed.', lang: 'en' }, update: { version: '1.5.0' } })
    mountPrompts(fake.source)
    await flushPromises()
    expect(dialogEntries).toHaveLength(1)
    expect(dialogEntries[0]!.component).toBe(UiReleaseNotesDialog)
    expect(dialogEntries[0]!.props).toEqual({ version: '1.4.3', notes: 'Fixed.', notesLocale: 'en' })
    expect(dialogEntries[0]!.opts.width).toBe('md')
    closeDialog(dialogEntries[0]!.id)
    await flushPromises()
    expect(fake.source.notesShown).toHaveBeenCalledOnce()
    expect(dialogEntries).toHaveLength(1)
    expect(dialogEntries[0]!.component).toBe(UiUpdateDialog)
    expect(dialogEntries[0]!.props).toEqual({ current: '1.4.3', latest: '1.5.0' })
    expect(dialogEntries[0]!.opts.width).toBe('sm')
  })

  it('ignore stores the version', async () => {
    const fake = fakeSource()
    mountPrompts(fake.source)
    await flushPromises()
    closeDialog(dialogEntries[0]!.id, 'ignore')
    await flushPromises()
    expect(fake.source.ignore).toHaveBeenCalledWith('1.5.0')
  })

  it('waits for the page to be visible', async () => {
    visibility('hidden')
    const fake = fakeSource()
    mountPrompts(fake.source)
    await flushPromises()
    fake.available()
    expect(fake.source.state).not.toHaveBeenCalled()
    expect(dialogEntries).toHaveLength(0)
    visibility('visible')
    await flushPromises()
    expect(fake.source.state).toHaveBeenCalledWith('en')
    expect(dialogEntries).toHaveLength(1)
  })

  it('prompts once per version', async () => {
    const fake = fakeSource()
    mountPrompts(fake.source)
    await flushPromises()
    fake.available()
    fake.available()
    expect(dialogEntries).toHaveLength(1)
    closeDialog(dialogEntries[0]!.id, 'later')
    await flushPromises()
    fake.available()
    await flushPromises()
    expect(dialogEntries).toHaveLength(0)
    expect(fake.source.ignore).not.toHaveBeenCalled()
  })

  it('asks for state in the current locale', async () => {
    const fake = fakeSource()
    mountPrompts(fake.source, 'pl')
    await flushPromises()
    expect(fake.source.state).toHaveBeenCalledWith('pl')
  })

  it('stays quiet when the source fails', async () => {
    const fake = fakeSource()
    fake.source.state.mockRejectedValue(new Error('unavailable'))
    mountPrompts(fake.source)
    await flushPromises()
    expect(dialogEntries).toHaveLength(0)
  })
})
