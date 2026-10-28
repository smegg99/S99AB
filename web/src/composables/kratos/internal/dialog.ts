// web/src/composables/kratos/internal/dialog.ts

// Set by the layer's Nuxt plugin to avoid an import cycle with the component.
let component: unknown

export function registerAuthDialog(dialog: unknown) {
  component = dialog
}

/** The registered dialog component, if the plugin ran. */
export function authDialog(): unknown {
  return component
}
