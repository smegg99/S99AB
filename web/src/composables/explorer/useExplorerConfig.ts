// web/src/composables/explorer/useExplorerConfig.ts

// Explorer defaults an app overrides through app.config s99ab.explorer.

import { reactive, readonly } from 'vue'
import { applyExplorerAccents } from './useExplorerAccents'

export interface ExplorerIcons {
  folder: string
  /** Shown while a drop into the folder is armed. */
  folderOpen: string
  /** For an empty folder; '' uses `folder`. */
  folderEmpty: string
  item: string
  up: string
  home: string
  menu: string
  create: string
  rename: string
  /** Tile selection marks, shown when tile.check is on. */
  selected: string
  unselected: string
  /** Pinned-node mark and menu entry glyph. */
  pin: string
}

/** How a tile is drawn; ExplorerBehaviour covers what it does. */
export interface ExplorerTileStyle {
  /**
   * `card`: bordered square with the cover and a name strip. `icon`: glyph or preview
   * with the name under it, no badge or tint bar.
   */
  variant: 'card' | 'icon'
  /** Card width over height; ignored by `icon`. */
  aspect: number
  fit: 'cover' | 'contain'
  /** Name placement on a tile with an image. */
  label: 'under' | 'over'
  hover: 'tint' | 'lift' | 'none'
  /** Default folder badge. */
  badge: 'count' | 'none'
  /** The ... trigger: on hover or focus, always, or never. Right-click opens the menu regardless. */
  menu: 'hover' | 'always' | 'none'
  /** A corner tick on every tile while selecting, for touch use. */
  check: boolean
}

export interface ExplorerBehaviour {
  /**
   * `double`: first click picks, second opens. `single`: a click opens and selection
   * needs ctrl, shift or the rubber band.
   */
  activate: 'single' | 'double'
  select: 'none' | 'single' | 'multi'
  /** Drag hover time in ms before a folder opens; 0 disables. */
  springOpen: number
  /** Arrow keys move focus and selection. */
  keyboard: boolean
}

/** App wording for pin menu entries; empty uses the explorer.pin and explorer.unpin locale keys. */
export interface ExplorerPinLabels {
  add: string
  remove: string
}

/** Optional fields the folder dialog offers. */
export interface ExplorerFolderFields {
  icon: boolean
  image: boolean
}

export interface ExplorerConfig {
  /** Root folders are depth 1; deeper drops are refused. */
  maxDepth: number
  foldersFirst: boolean
  /** Minimum column width in px. */
  tileMin: number
  /** Tints the folder dialog offers; each needs a declared --s99ab-accent-<name>. */
  accents: string[]
  /** Runtime tints as `#rrggbb` or `r, g, b`, so an app can add or retune one without Sass. */
  accentColors: Record<string, string>
  icons: ExplorerIcons
  tile: ExplorerTileStyle
  behaviour: ExplorerBehaviour
  pin: ExplorerPinLabels
  folderFields: ExplorerFolderFields
  /** Glyphs offered by the folder dialog's icon picker. */
  folderIcons: string[]
}

/** A partial override; nested maps merge per entry. */
export type ExplorerConfigPatch
  = Partial<Omit<ExplorerConfig, 'icons' | 'tile' | 'behaviour' | 'folderFields'>> & {
    icons?: Partial<ExplorerIcons>
    tile?: Partial<ExplorerTileStyle>
    behaviour?: Partial<ExplorerBehaviour>
    folderFields?: Partial<ExplorerFolderFields>
  }

const config = reactive<ExplorerConfig>({
  maxDepth: 8,
  foldersFirst: true,
  // Mirrored by $tile-min, which lays out the grid before UiExplorer runs.
  tileMin: 104,
  accents: [
    'red',
    'orange',
    'amber',
    'green',
    'teal',
    'blue',
    'indigo',
    'purple',
    'pink',
    'slate',
  ],
  accentColors: {},
  // mdi font names; an app may pass any icon strings.
  icons: {
    folder: 'mdi-folder',
    folderOpen: 'mdi-folder-open',
    folderEmpty: '',
    item: 'mdi-file-outline',
    up: 'mdi-arrow-up',
    home: 'mdi-home',
    menu: 'mdi-dots-horizontal',
    create: 'mdi-folder-plus',
    rename: 'mdi-pencil',
    selected: 'mdi-check-circle',
    unselected: 'mdi-checkbox-blank-circle-outline',
    pin: 'mdi-pin',
  },
  tile: {
    variant: 'icon',
    aspect: 1,
    fit: 'cover',
    label: 'under',
    hover: 'tint',
    badge: 'count',
    menu: 'hover',
    check: false,
  },
  // Navigation-only screens use `activate: 'single'` with `select: 'none'`.
  behaviour: {
    activate: 'double',
    select: 'multi',
    springOpen: 600,
    keyboard: true,
  },
  pin: { add: '', remove: '' },
  // Off until the app's source stores these fields.
  folderFields: { icon: false, image: false },
  folderIcons: [
    'mdi-folder',
    'mdi-folder-star',
    'mdi-folder-heart',
    'mdi-folder-account',
    'mdi-folder-image',
    'mdi-folder-music',
    'mdi-folder-download',
    'mdi-folder-lock',
    'mdi-folder-clock',
    'mdi-folder-cog',
  ],
})

/** Called by the layer's Nuxt plugin with the app's s99ab.explorer config. */
export function configureExplorer(patch: ExplorerConfigPatch) {
  // Merge nested maps per entry.
  const { icons, tile, behaviour, pin, folderFields, ...rest } = patch
  Object.assign(config, rest)
  if (icons) Object.assign(config.icons, icons)
  if (tile) Object.assign(config.tile, tile)
  if (behaviour) Object.assign(config.behaviour, behaviour)
  if (pin) Object.assign(config.pin, pin)
  if (folderFields) Object.assign(config.folderFields, folderFields)
}

export function applyExplorerTints() {
  applyExplorerAccents(config.accentColors)
}

export function useExplorerConfig() {
  return readonly(config)
}

/** The live config object, read on every access so runtime changes apply. */
export function explorerDefaults(): ExplorerConfig {
  return config
}
