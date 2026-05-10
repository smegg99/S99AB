// web/src/appearance.ts
//
// Entry point for a desktop shell's OS appearance bridge, importable by path
// because the generated bridge runs outside the layer's auto-imports.

export {
  type AppearanceSource,
  registerAppearanceSource,
  resetAppearanceSource,
  useAppearance,
} from './composables/appearance/useAppearance'
