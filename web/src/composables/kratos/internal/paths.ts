// web/src/composables/kratos/internal/paths.ts

import { reactive } from 'vue'
import type { AuthPaths } from '../useAuthPaths'

export const paths = reactive<AuthPaths>({
  signInPath: '',
  signUpPath: '',
  homePath: '',
  settingsPath: '',
})

/** Called by the layer's Nuxt plugin with s99ab.auth. */
export function configureAuthPaths(patch: Partial<AuthPaths>) {
  Object.assign(paths, patch)
}
