// web/tests/entries.spec.ts

import { describe, expect, it } from 'vitest'
import * as appearance from '../src/appearance'
import * as explorer from '../src/explorer'
import * as kratos from '../src/kratos'
import * as toast from '../src/toast'

// What consumer apps call outside setup: their plugins and pages configure the layer through these.
describe('the subpath entries', () => {
  it.each([
    ['appearance', appearance, ['configureGround', 'applyGround', 'groundConfig', 'DEFAULT_PLANES', 'THEME_TRANSITIONS']],
    ['explorer', explorer, ['configureExplorer', 'applyExplorerTints', 'accentTriplet']],
    ['kratos', kratos, ['configureAuthPaths', 'authFlowKind', 'resolveReturnTo', 'isAuthFlowRoute', 'kratosSignOut', 'kratosRefreshSession']],
    ['toast', toast, ['configureToast']],
  ])('%s exports what consumers call', (_, entry, names) => {
    for (const name of names as string[]) expect(entry, name).toHaveProperty(name)
  })
})
