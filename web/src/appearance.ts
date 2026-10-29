// web/src/appearance.ts
//
// Appearance helpers for code outside setup, such as a desktop shell's OS
// appearance bridge: `@smegg99/s99ab/appearance`.

export { type AppearanceSource, useAppearance } from './composables/appearance/useAppearance'
export { registerAppearanceSource, resetAppearanceSource } from './composables/appearance/internal/appearance'
export { TEXTURES, applyTexture, textureConfig } from './composables/appearance/internal/texture'
export { supportsWebgl } from './composables/appearance/internal/flow'
export { originOf, type TransitionOrigin } from './composables/appearance/internal/cover'
