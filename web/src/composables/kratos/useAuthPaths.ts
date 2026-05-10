// web/src/composables/kratos/useAuthPaths.ts

import { reactive, readonly } from 'vue'

/** App paths for the auth screens; a 401 links to signInPath. */
export interface AuthPaths {
  signInPath: string
  /** Empty where an app does not let people register themselves. */
  signUpPath: string
  /** Exit link on the auth page, which has no bar or rail. Empty hides it. */
  homePath: string
  /** The settings flow's path. Empty for an app with nothing to change. */
  settingsPath: string
}

const paths = reactive<AuthPaths>({
  signInPath: '',
  signUpPath: '',
  homePath: '',
  settingsPath: '',
})

/** Called by the layer's Nuxt plugin with s99ab.auth. */
export function configureAuthPaths(patch: Partial<AuthPaths>) {
  Object.assign(paths, patch)
}

export function useAuthPaths(): Readonly<AuthPaths> {
  return readonly(paths)
}
