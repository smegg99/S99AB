// web/src/composables/kratos/internal/route.ts
//
// Auth flow kind and return_to from the URL, without importing vue-router.

import { computed, type ComputedRef } from 'vue'
import { useAuthPaths } from '../useAuthPaths'
import type { KratosFlowKind } from './types'

export interface AuthRoute {
  fullPath: string
  params: Record<string, unknown>
  query: Record<string, unknown>
}

export interface AuthRouting {
  route: () => AuthRoute
  push: (to: { path: string, query?: Record<string, string> }) => void
}

/** The dynamic segment an app names its auth page after: `pages/[flow].vue`. */
export const AUTH_FLOW_PARAM = 'flow'

/** URL segment to flow kind; apps add localized segments via `s99ab.auth.flowRoutes`. */
export const AUTH_FLOW_ROUTES: Record<string, KratosFlowKind> = {
  login: 'login',
  register: 'registration',
  recover: 'recovery',
  verify: 'verification',
  settings: 'settings',
}

/** Merges `s99ab.auth.flowRoutes` into the defaults, keeping the other flows. */
export function configureAuthFlowRoutes(patch: Record<string, KratosFlowKind>) {
  Object.assign(AUTH_FLOW_ROUTES, patch)
}

function segment(route: AuthRoute | undefined): string {
  const raw = route?.params?.[AUTH_FLOW_PARAM]
  return typeof raw === 'string' ? raw : ''
}

export function authFlowKind(route: AuthRoute | undefined): KratosFlowKind | undefined {
  return AUTH_FLOW_ROUTES[segment(route)]
}

/**
 * For `definePageMeta({ validate })`. Without it `[flow]` answers for every
 * unmatched path in the app.
 */
export function isAuthFlowRoute(route: AuthRoute): boolean {
  return Boolean(authFlowKind(route))
}

/**
 * Where a finished flow lands, from `?return_to=`.
 *
 * Same origin only. Kratos redirects to whatever it is handed, so an absolute
 * URL off this origin is an open redirect with extra steps. `new URL` resolves
 * a relative path against ours and leaves an absolute one alone, so the check
 * has to come after it.
 */
export function resolveReturnTo(raw: unknown, origin: string): string {
  if (typeof raw !== 'string' || !raw || !origin) return ''

  try {
    const url = new URL(raw, origin)
    return url.origin === origin ? url.toString() : ''
  }
  catch {
    return ''
  }
}

let routing: AuthRouting | undefined

/** Installed by the layer plugin, like registerTableRouter. */
export function registerAuthRouting(next: AuthRouting) {
  routing = next
}

export function authRoute(): AuthRoute | undefined {
  return routing?.route()
}

// Navigates to an auth screen with the current page as return_to.
function goToFlow(path: string) {
  const here = routing?.route().fullPath
  if (!routing || !path) return

  routing.push(here ? { path, query: { return_to: here } } : { path })
}

export function goToSignIn() {
  goToFlow(useAuthPaths().signInPath)
}

export function goToSignUp() {
  goToFlow(useAuthPaths().signUpPath)
}

export function useAuthFlowKind(fallback: KratosFlowKind = 'login'): ComputedRef<KratosFlowKind> {
  return computed(() => authFlowKind(authRoute()) ?? fallback)
}

/** Empty under SSR, and for a `return_to` pointing off this origin. */
export function useReturnTo(): ComputedRef<string> {
  return computed(() => {
    if (typeof window === 'undefined') return ''
    return resolveReturnTo(authRoute()?.query?.return_to, window.location.origin)
  })
}
