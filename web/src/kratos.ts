// web/src/kratos.ts
//
// Kratos node, rule and route helpers for code outside setup: `@smegg99/s99ab/kratos`.

export {
  isKratosCode,
  isKratosHidden,
  isKratosInput,
  isKratosPrimary,
  isKratosSubmit,
  kratosAutocomplete,
  kratosGroup,
  kratosInputMode,
  kratosInputType,
  kratosLabel,
  kratosNodeKind,
  kratosSeverity,
  type KratosNodeKind,
} from './composables/kratos/internal/nodes'
export { isKratosEmail, kratosMessageText, kratosRules, type Rule as KratosRule } from './composables/kratos/internal/rules'
export { kratosRefreshSession, kratosSignOut } from './composables/kratos/internal/api'
export { goToSignIn, goToSignUp, isAuthFlowRoute, isAuthPath, type AuthRoute } from './composables/kratos/internal/route'
export type {
  KratosConfig,
  KratosFlow,
  KratosFlowKind,
  KratosMessage,
  KratosMessageType,
  KratosNode,
  KratosNodeAttributes,
} from './composables/kratos/internal/types'
export type { KratosFlowApi, KratosFlowOptions, KratosNotice, KratosSuccess } from './composables/kratos/internal/api'
export { configureAuthPaths } from './composables/kratos/internal/paths'
export { authFlowKind, resolveReturnTo } from './composables/kratos/internal/route'
