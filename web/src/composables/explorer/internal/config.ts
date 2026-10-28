// web/src/composables/explorer/internal/config.ts

import { reactive } from 'vue'
import { applyExplorerAccents } from './accents'
import type { ExplorerConfig, ExplorerConfigPatch } from '../useExplorerConfig'

export const config = reactive<ExplorerConfig>({
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

/** The live config object, read on every access so runtime changes apply. */
export function explorerDefaults(): ExplorerConfig {
  return config
}
