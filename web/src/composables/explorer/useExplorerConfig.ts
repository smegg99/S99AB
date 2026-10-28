// web/src/composables/explorer/useExplorerConfig.ts

// Explorer defaults an app overrides through app.config s99ab.explorer.

import { readonly } from 'vue'
import { config } from './internal/config'

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

export function useExplorerConfig() {
  return readonly(config)
}
