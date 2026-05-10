// web/tests/copy.spec.ts

import { effectScope, nextTick } from 'vue'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { useCopy } from '../src/composables/useCopy'

function withScope<T>(fn: () => T): { value: T, stop: () => void } {
  const scope = effectScope()
  const value = scope.run(fn)!
  return { value, stop: () => scope.stop() }
}

function clipboard(writeText: () => Promise<void>) {
  vi.stubGlobal('navigator', { clipboard: { writeText } })
}

afterEach(() => {
  vi.unstubAllGlobals()
  vi.useRealTimers()
})

describe('useCopy', () => {
  it('writes the text and says so, then stops saying so', async () => {
    vi.useFakeTimers()
    const writeText = vi.fn(async () => {})
    clipboard(writeText)

    const { value: copy, stop } = withScope(() => useCopy(1000))
    await copy.copy('sha256:abc')
    await nextTick()

    expect(writeText).toHaveBeenCalledWith('sha256:abc')
    expect(copy.copied.value).toBe(true)

    // The button reads the flag to swap its icon back.
    vi.advanceTimersByTime(1100)
    expect(copy.copied.value).toBe(false)
    stop()
  })

  // Insecure origin, denied permission, automated browser: no unhandled rejection.
  it('stays quiet when the clipboard refuses', async () => {
    clipboard(async () => {
      throw new Error('NotAllowedError')
    })

    const { value: copy, stop } = withScope(() => useCopy())
    await expect(copy.copy('sha256:abc')).resolves.toBeUndefined()
    expect(copy.copied.value).toBe(false)
    stop()
  })

  it('does nothing with an empty value', async () => {
    const writeText = vi.fn(async () => {})
    clipboard(writeText)

    const { value: copy, stop } = withScope(() => useCopy())
    await copy.copy('')

    expect(writeText).not.toHaveBeenCalled()
    stop()
  })
})
