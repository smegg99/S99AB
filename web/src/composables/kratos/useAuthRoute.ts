// web/src/composables/kratos/useAuthRoute.ts
//
// Auto-import surface for internal/route.ts; Nuxt does not scan subdirectories.

export {
  AUTH_FLOW_PARAM,
  AUTH_FLOW_ROUTES,
  authFlowKind,
  authRoute,
  configureAuthFlowRoutes,
  goToSignIn,
  goToSignUp,
  isAuthFlowRoute,
  isAuthPath,
  registerAuthRouting,
  resolveReturnTo,
  useAuthFlowKind,
  useReturnTo,
} from './internal/route'

export type { AuthRoute, AuthRouting } from './internal/route'
