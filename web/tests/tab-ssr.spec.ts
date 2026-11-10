// web/tests/tab-ssr.spec.ts
// @vitest-environment node

import { createSSRApp, h, ref } from 'vue'
import { renderToString } from 'vue/server-renderer'
import { expect, it } from 'vitest'
import { useNativeStrip } from '../src/composables/tabs/internal/nativeStrip'
import type { WorkspaceTab } from '../src/composables/tabs/useTabs'

it('renders the native strip state without browser globals', async () => {
  const app = createSSRApp({ setup() {
    useNativeStrip({
      native: () => undefined, list: ref(), elements: new Map(), shown: ref<WorkspaceTab[]>([]),
      titleOf: tab => tab.id, dropping: ref(false), dropSlot: ref(null), ghost: ref(null), grab: 16,
    })
    return () => h('div', 'tabs')
  } })
  expect(await renderToString(app)).toBe('<div>tabs</div>')
})
