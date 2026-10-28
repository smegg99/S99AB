// web/tests/mount.ts

// Vuetify as the layer's components need it in a spec: every component and directive registered.
import { createVuetify, type VuetifyOptions } from 'vuetify'
import * as components from 'vuetify/components'
import * as directives from 'vuetify/directives'

export const vuetify = createVuetify({ components, directives })

/** A Vuetify with spec-specific options, such as instant tooltips. */
export function vuetifyWith(options: VuetifyOptions): ReturnType<typeof createVuetify> {
  return createVuetify({ components, directives, ...options })
}
