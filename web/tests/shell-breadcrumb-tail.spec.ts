// web/tests/shell-breadcrumb-tail.spec.ts

import { effectScope, nextTick, ref } from 'vue'
import { describe, expect, it } from 'vitest'
import { useBreadcrumbTail } from '../src/composables/shell/useBreadcrumbs'
import { tail } from '../src/composables/shell/internal/breadcrumbs'

describe('useBreadcrumbTail', () => {
  it('follows its label while the scope lives and clears it after', async () => {
    const label = ref<string | undefined>('Report 7')
    const scope = effectScope()
    scope.run(() => useBreadcrumbTail(() => label.value))
    expect(tail.value).toBe('Report 7')
    label.value = 'Report 8'
    await nextTick()
    expect(tail.value).toBe('Report 8')
    scope.stop()
    expect(tail.value).toBeUndefined()
  })
})
