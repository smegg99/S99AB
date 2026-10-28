// web/src/browser.ts
//
// DOM and input helpers for code outside setup: `@smegg99/s99ab/browser`.

export { focusStart, hasFocusRing } from './browser/focus'
export { trackPointer, type PointerTrack } from './browser/pointer'
export { tileOf, whenTile, middleClick, shiftPick } from './browser/tiles'
export { undoStep, passUndo, listUndo } from './browser/edit'
export { scrollsDown } from './browser/scroll'
export { cutWords, fitWordRun, isCut, wordBoxes, wordsRoom } from './composables/primitives/internal/text'
export { createPointerDrag, inZone, type DropPlace, type Over } from './composables/primitives/internal/pointerDrag'
export { takeRow } from './composables/primitives/internal/treeKeys'
export { createPendingSaves } from './composables/primitives/internal/listUndo'
export { statOrder } from './composables/primitives/internal/paneFoot'
export { prefersReducedMotion } from './composables/motion/internal/motion'
