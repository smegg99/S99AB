// web/src/tabs.ts
//
// Workspace tabs, the context menu and the native drag types for code outside setup:
// `@smegg99/s99ab/tabs`.

export { useTabs, type TabsOptions, type WorkspaceTab } from './composables/tabs/useTabs'
export {
  closeContextMenu,
  openContextMenu,
  useContextMenuState,
  wantsNativeMenu,
  type MenuEntry,
} from './composables/tabs/internal/contextMenu'
export {
  useTabDrag,
  type NativeTabDrag,
  type NativeTabFace,
  type NativeTabTrack,
  type TabStripGeometry,
  type TabWorkspace,
} from './composables/tabs/internal/tabDrag'
