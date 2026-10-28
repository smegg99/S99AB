// web/src/composables/explorer/internal/context.ts

import type { InjectionKey } from 'vue'
import type { ExplorerApi } from '../useExplorer'

export const explorerKey: InjectionKey<ExplorerApi> = Symbol('s99ab:explorer')
