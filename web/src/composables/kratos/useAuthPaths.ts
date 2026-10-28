// web/src/composables/kratos/useAuthPaths.ts

import { readonly } from 'vue'
import { paths } from './internal/paths'

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

export function useAuthPaths(): Readonly<AuthPaths> {
  return readonly(paths)
}
