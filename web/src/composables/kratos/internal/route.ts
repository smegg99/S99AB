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

/** Caps return_to so a value re-encoded into itself cannot grow without bound. */
const MAX_RETURN_TO = 512

/**
 * Same-origin path from `?return_to=`, or '' (a path avoids allowed_return_urls,
 * the origin check blocks open redirects). Auth routes are refused unless `allowAuthPath`.
 */
export function resolveReturnTo(
  raw: unknown,
  origin: string,
  { allowAuthPath = false }: { allowAuthPath?: boolean } = {},
): string {
  if (typeof raw !== 'string' || !raw || !origin) return ''
  if (raw.length > MAX_RETURN_TO) return ''

  try {
    const url = new URL(raw, origin)
    if (url.origin !== origin) return ''

    const here = url.pathname + url.search + url.hash
    return !allowAuthPath && isAuthPath(here) ? '' : here
  }
  catch {
    return ''
  }
}

/** Whether a path's last segment is an auth flow; apps mount them under their own prefix. */
export function isAuthPath(path: string): boolean {
  const segment = path.split('?')[0]?.split('#')[0]?.split('/').filter(Boolean).pop() ?? ''
  return segment in AUTH_FLOW_ROUTES
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
  if (!routing) return

  // Drops an auth route, so sign-in pressed on the sign-in page does not nest.
  const origin = typeof window === 'undefined' ? 'http://localhost' : window.location.origin
  const here = resolveReturnTo(routing.route().fullPath, origin)
  if (!path) return

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

/** The URL's return_to as a path; empty under SSR or when refused. */
export function useReturnTo(): ComputedRef<string> {
  return computed(() => {
    if (typeof window === 'undefined') return ''
    return resolveReturnTo(authRoute()?.query?.return_to, window.location.origin)
  })
}
