// web/src/types.ts
//
// The public type surface, since Nuxt does not auto-import types:
//   import type { ToastPosition } from '@smegg99/s99ab/types'

export type {
  Toast,
  ToastAction,
  ToastConfig,
  ToastConfigPatch,
  ToastIcons,
  ToastKind,
  ToastOptions,
  ToastPosition,
  ToastProgress,
  ToastPromise,
  ToastUpdate,
} from './composables/toast/useToast'

export type {
  AppearanceConfig,
  AppearanceConfigPatch,
  AppearanceKeys,
} from './composables/appearance/useAppearance'

export type {
  GroundConfig,
  GroundKind,
  GroundShape,
} from './composables/appearance/internal/flow'

export type { ScrollRoute, ScrollSaved } from './composables/shell/internal/scroll'
export type { ScrollSpy } from './composables/shell/useScrollSpy'

export type { Highlightable, Token, TokenKind } from './composables/markdown/internal/highlight'

export type {
  PlaneName,
  TextureConfig,
  TextureConfigPatch,
  TextureFamily,
  TextureSpec,
} from './composables/appearance/useTexture'

export type {
  ConfirmOptions,
  DialogEntry,
  DialogOptions,
  DialogWidth,
  PromptOptions,
} from './composables/useDialog'

export type {
  DataTableHeader,
  Fetcher,
  Page,
  ServerTableOptions,
  SortItem,
  TableBind,
  TableParams,
  TableState,
} from './composables/table/useServerTable'

export type {
  MotionConfig,
  MotionConfigPatch,
  MotionLevel,
  MotionName,
  ResolvedMotionLevel,
} from './composables/motion/useMotion'

export type {
  ThemeTransition,
  ThemeTransitionConfig,
  TransitionOrigin,
} from './composables/appearance/useThemeTransition'

export type {
  ActiveShortcut,
  ShortcutDef,
  ShortcutMap,
  ShortcutOptions,
} from './composables/useShortcut'

export type {
  ExplorerApi,
  ExplorerFolderInput,
  ExplorerMove,
  ExplorerOptions,
  ExplorerSource,
} from './composables/explorer/useExplorer'

export type {
  KratosConfig,
  KratosFlow,
  KratosFlowApi,
  KratosFlowKind,
  KratosMessage,
  KratosMessageType,
  KratosNode,
  KratosNodeAttributes,
  KratosNodeKind,
} from './composables/kratos/useKratosFlow'

export type {
  ExplorerBehaviour,
  ExplorerConfig,
  ExplorerConfigPatch,
  ExplorerFolderFields,
  ExplorerIcons,
  ExplorerPinLabels,
  ExplorerTileStyle,
} from './composables/explorer/useExplorerConfig'

export type {
  ExplorerCompare,
  ExplorerKind,
  ExplorerNode,
  ExplorerOrder,
} from './composables/explorer/useExplorerTree'

export type { ExplorerActions } from './composables/explorer/useExplorerNode'
export type { ExplorerFaceState } from './composables/explorer/useExplorerFace'
export type {
  ExplorerDrag,
  ExplorerDragHost,
} from './composables/explorer/useExplorerDrag'
export type { ExplorerFolderDraft } from './composables/explorer/useExplorerFolders'
export type {
  ExplorerEventMap,
  ExplorerEventName,
  ExplorerEvents,
  ExplorerListener,
} from './composables/explorer/useExplorerEvents'
export type { ExplorerKeyHost } from './composables/explorer/useExplorerKeys'
export type {
  ExplorerPickMods,
  ExplorerSelection,
} from './composables/explorer/useExplorerSelection'

export type {
  Rule,
  ZodFormResult,
  ZodIssue,
  ZodLike,
  ZodRulesOptions,
} from './composables/useZodRules'

export type { ApiError } from './composables/state/useApiError'
export type { DelayConfig } from './composables/useDelay'
export type {
  EventSourceConfig,
  EventSourceReconnect,
  EventSourceStatus,
  UseEventSourceOptions,
  UseEventSourceReturn,
} from './composables/useEventSource'
export type { QueryLike } from './composables/state/useAsyncState'
export type { AccountIdentity } from './composables/kratos/useAccountIdentity'
export type { AppearanceSource } from './composables/appearance/useAppearance'
export type { TableLike } from './composables/table/useTableFrame'
export type {
  BuildVersion,
  BuildVersionOptions,
} from './composables/releases/useBuildVersion'
export type {
  KratosFieldsApi,
} from './composables/kratos/useKratosFields'
export type {
  TrailMetrics,
  TrailNode,
  TrailPoint,
  TrailRow,
} from './composables/shell/useNavTrail'

export type {
  Palette,
  PaletteName,
  PaletteOptions,
  PaletteSpec,
} from './theme/palette'

/** One navigation entry. `label` is already translated by the app. */
export interface NavLink {
  to: string
  label: string
  icon?: string
  /** A count or short status at the trailing edge. */
  badge?: string | number
  /** Match the exact path only. Off by default, so /files/3 keeps /files lit. */
  exact?: boolean
  /** Opens in a new tab as a plain link, so it never shows as the current page. */
  newTab?: boolean
  /** Nested destinations, drawn one level in. Depth comes from the tree. */
  children?: NavLink[]
}

/** A titled run of links. A single untitled group is the flat case. */
export interface NavGroup {
  label?: string
  items: NavLink[]
}

/** Which body UiNavDrawer draws. `trail` is the animated rail; see UiNavTrail. */
export type NavVariant = 'list' | 'trail'

/**
 * How the current row is marked, independent of the variant: `both` (face and
 * accent ink), `accent` (accent ink only), `face` (face only), `plain` (full ink,
 * heavier weight). Hover keeps its face in all four.
 */
export type NavLit = 'both' | 'accent' | 'face' | 'plain'

/** One UiLocaleMenu choice: the code and its name in its own language. */
export interface LocaleOption {
  value: string
  title: string
}

/** One UiToolGroup face. A union, so an icon-only item must carry a `title`. */
export type ToolItem = { value: ToolValue, label: string, icon?: string, title?: string }
  | { value: ToolValue, icon: string, title: string, label?: undefined }

export type ToolValue = string | number | boolean

export type { WorkspaceTab, TabsOptions } from './composables/tabs/useTabs'
export type { MenuEntry } from './composables/tabs/internal/contextMenu'
export type { TabWorkspace, NativeTabDrag, NativeTabFace, NativeTabTrack, TabStripGeometry } from './composables/tabs/useTabDrag'

export type { FooterStat } from './composables/primitives/internal/paneFoot'

export type {
  CrashScreenActions,
  CrashScreenKind,
  CrashScreenReport,
} from './components/state/crashScreen'
