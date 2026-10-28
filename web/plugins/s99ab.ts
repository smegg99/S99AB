// web/plugins/s99ab.ts
//
// Feeds app.config into the framework-free modules under src/.

import AuthDialog from '../src/components/auth/AuthDialog.vue'
import ConfirmDialog from '../src/components/overlay/ConfirmDialog.vue'
import PromptDialog from '../src/components/overlay/PromptDialog.vue'
import type { AppearanceConfig } from '../src/composables/appearance/useAppearance'
import { appearanceConfig, configureAppearance } from '../src/composables/appearance/internal/appearance'
import { applyLite, configureEffects, effectsConfig } from '../src/composables/appearance/internal/effects'
import {
  type AuthPaths,
  configureAuthPaths,
} from '../src/composables/kratos/useAuthPaths'
import {
  configureAuthFlowRoutes,
  registerAuthRouting,
} from '../src/composables/kratos/internal/route'
import type { KratosFlowKind } from '../src/composables/kratos/internal/types'
import { registerAuthDialog } from '../src/composables/kratos/useAuthDialog'
import { registerDialogPresets } from '../src/internal/dialog'
import { configureDelay, type DelayConfig } from '../src/internal/delay'
import type { EventSourceConfig } from '../src/composables/useEventSource'
import { configureEventSource } from '../src/internal/eventSource'
import type { ExplorerConfigPatch } from '../src/composables/explorer/useExplorerConfig'
import { applyExplorerTints, configureExplorer } from '../src/composables/explorer/internal/config'
import type { GroundConfig } from '../src/composables/appearance/internal/flow'
import { applyGround, configureGround } from '../src/composables/appearance/internal/flow'
import {
  configureKratos,
  type KratosConfig,
} from '../src/composables/kratos/useKratosFlow'
import { configureMotion, type MotionConfigPatch } from '../src/composables/motion/internal/motion'
import type { ReleasesConfig } from '../src/composables/releases/useReleases'
import { configureReleases } from '../src/composables/releases/internal/api'
import type { TableConfig } from '../src/composables/table/useServerTable'
import { configureTable, registerTableRouter } from '../src/composables/table/internal/config'
import { configureThemeTransition, type ThemeTransitionConfig } from '../src/composables/appearance/internal/themeTransition'
import ShortcutHelp from '../src/components/shortcut/ShortcutHelp.vue'
import {
  registerShortcutHelp,
  registerShortcuts,
  type ShortcutMap,
} from '../src/internal/shortcut'
import { type TextureConfigPatch, useTexture } from '../src/composables/appearance/useTexture'
import { applyTexture, configureTexture } from '../src/composables/appearance/internal/texture'
import { configureToast, type ToastConfigPatch } from '../src/composables/toast/internal/config'
import { type PaletteName, paletteTexture } from '../src/theme/palette'

export default defineNuxtPlugin(() => {
  const s99ab = (
    useAppConfig() as {
      s99ab?: {
        toast?: ToastConfigPatch
        motion?: MotionConfigPatch
        shortcuts?: ShortcutMap
        explorer?: ExplorerConfigPatch
        releases?: Partial<ReleasesConfig>
        table?: Partial<TableConfig>
        themeTransition?: Partial<ThemeTransitionConfig>
        delay?: Partial<DelayConfig>
        sse?: Partial<EventSourceConfig>
        kratos?: Partial<KratosConfig>
        auth?: Partial<AuthPaths>
        appearance?: Partial<AppearanceConfig>
        // Only the palette's texture applies here; s99abTheme() builds its colours.
        palette?: PaletteName
        texture?: TextureConfigPatch
        // The ground: washes, gradient and shader parameters.
        ground?: Partial<GroundConfig>
        // Flat, opaque, motionless form for a low-power GPU or WebKitGTK.
        performance?: { lite?: boolean }
      }
    }
  ).s99ab
  if (s99ab?.toast) configureToast(s99ab.toast)
  if (s99ab?.motion) configureMotion(s99ab.motion)
  if (s99ab?.explorer) configureExplorer(s99ab.explorer)
  // Always written, so clearing tints at runtime removes the previous set.
  applyExplorerTints()
  if (s99ab?.releases) configureReleases(s99ab.releases)
  if (s99ab?.table) configureTable(s99ab.table)
  if (s99ab?.themeTransition) configureThemeTransition(s99ab.themeTransition)
  if (s99ab?.delay) configureDelay(s99ab.delay)
  if (s99ab?.sse) configureEventSource(s99ab.sse)
  if (s99ab?.kratos) configureKratos(s99ab.kratos)
  // s99ab.auth carries the paths for useAuthPaths and the segment map for the
  // flow router; the config type admits only the first.
  const auth = s99ab?.auth as
    | (Partial<AuthPaths> & {
      flowRoutes?: Record<string, KratosFlowKind>
    })
    | undefined
  if (auth) configureAuthPaths(auth)
  if (auth?.flowRoutes) configureAuthFlowRoutes(auth.flowRoutes)
  if (s99ab?.appearance) configureAppearance(s99ab.appearance)
  if (s99ab?.ground) configureGround(s99ab.ground)

  // Lite mode, set before first paint so nothing renders frosted for a frame.
  // applyLite also turns motion off: the loaders' SVG blur stalls WebKitGTK.
  configureEffects({
    storageKey: `${appearanceConfig().storageKey}.effects`,
    liteDefault: s99ab?.performance?.lite ?? false,
  })
  applyLite(effectsConfig().liteDefault)

  applyGround()

  // Palette texture first, so `s99ab.texture` patches it; the user's stored
  // pick wins over both.
  if (s99ab?.palette) configureTexture(paletteTexture(s99ab.palette))
  if (s99ab?.texture) configureTexture(s99ab.texture)
  applyTexture()
  useTexture().restore()

  if (s99ab?.shortcuts) registerShortcuts(s99ab.shortcuts)
  registerShortcutHelp(ShortcutHelp)

  // Components registered here to avoid import cycles with their composables.
  registerDialogPresets(ConfirmDialog, PromptDialog)
  registerAuthDialog(AuthDialog)

  registerAuthRouting({
    route: () => {
      const route = useRoute()
      return {
        fullPath: route.fullPath,
        params: route.params,
        query: route.query,
      }
    },
    push: to => void navigateTo(to),
  })

  // Injected so a table that never syncs the URL does not pull in vue-router.
  registerTableRouter(() => {
    const route = useRoute()
    const router = useRouter()
    return {
      get query() {
        return route.query as Record<string, string | undefined>
      },
      replace(query) {
        void router.replace({ query })
      },
    }
  })
})
