// web/src/composables/kratos/useKratosFlow.ts

import { computed, reactive, ref } from 'vue'
import { config } from './internal/types'
import { isKratosHidden, isKratosInput, isKratosSubmit } from './internal/nodes'
import { AlreadySignedIn, NotSignedIn, flowIdFromLocation, onThisOrigin } from './internal/api'
import type { KratosFlow, KratosFlowKind } from './internal/types'
import type {
  KratosFlowApi,
  KratosFlowOptions,
  KratosNotice,
  KratosSuccess,
} from './internal/api'

export * from './internal/types'
export * from './internal/nodes'
export { kratosSignOut, type KratosFlowApi, type KratosFlowOptions, type KratosSuccess } from './internal/api'

/** `kind` may be a getter, so a destructured prop stays reactive. */
export function useKratosFlow(
  kind: KratosFlowKind | (() => KratosFlowKind),
  options: KratosFlowOptions = {},
): KratosFlowApi {
  const flowKind = () => (typeof kind === 'function' ? kind() : kind)

  const flow = ref<KratosFlow | null>(null)
  const pending = ref(true)
  const failed = ref(false)
  const notice = ref<KratosNotice | null>(null)

  // Seeded from the flow, so a rejected submit keeps the fields filled in.
  const values = reactive<Record<string, string>>({})

  function load(data: KratosFlow) {
    flow.value = data
    // Cleared in place: fields are bound to this object.
    // eslint-disable-next-line @typescript-eslint/no-dynamic-delete
    for (const key of Object.keys(values)) delete values[key]
    for (const node of data.ui.nodes) {
      const name = node.attributes.name
      if (!name || !isKratosInput(node)) continue
      values[name]
        = node.attributes.value == null ? '' : String(node.attributes.value)
    }
  }

  const submitting = ref(false)
  // Set once the browser is navigating away, so the spinner stays up.
  const leaving = ref(false)

  // fetch has no timeout; a proxy in front of a stopped Kratos never settles.
  // Past this the request rejects into the error state with a retry.
  const TIMEOUT_MS = 15_000

  function deadline(): AbortSignal | undefined {
    // Feature-detected: jsdom does not always have AbortSignal.timeout.
    return typeof AbortSignal !== 'undefined' && 'timeout' in AbortSignal
      ? AbortSignal.timeout(TIMEOUT_MS)
      : undefined
  }

  function ask(url: string, init: RequestInit = {}) {
    // The JSON accept header makes Kratos answer with the flow instead of a redirect.
    return fetch(url, {
      credentials: 'include',
      signal: deadline(),
      ...init,
      headers: { accept: 'application/json', ...init.headers },
    })
  }

  async function createFlow(carryReturnTo = true): Promise<KratosFlow> {
    const query = carryReturnTo && options.returnTo
      ? `?return_to=${encodeURIComponent(options.returnTo)}`
      : ''
    const res = await ask(
      `${config.basePath}/self-service/${flowKind()}/browser${query}`,
    )
    if (!res.ok) {
      const body = (await res.json().catch(() => null)) as {
        error?: { id?: string }
      } | null

      // return_to not in allowed_return_urls: retry once without it, so a
      // misconfigured origin loses the redirect instead of the flow.
      if (query && body?.error?.id === 'self_service_flow_return_to_forbidden') {
        return createFlow(false)
      }
      // Kratos refuses login, registration and recovery flows to a live session.
      if (body?.error?.id === 'session_already_available') {
        throw new AlreadySignedIn()
      }
      // A settings flow without a session answers 401 session_inactive.
      if (body?.error?.id === 'session_inactive' || res.status === 401) {
        throw new NotSignedIn()
      }
      throw new Error(`kratos ${flowKind()} flow ${res.status}`)
    }
    return (await res.json()) as KratosFlow
  }

  async function readFlow(id: string): Promise<KratosFlow> {
    const res = await ask(
      `${config.basePath}/self-service/${flowKind()}/flows?id=${encodeURIComponent(id)}`,
    )
    // 410 expired, 403 wrong CSRF cookie, 404 unknown id: all fixed by a new flow.
    if (!res.ok) throw new Error(`kratos flow ${res.status}`)
    return (await res.json()) as KratosFlow
  }

  /** Drops ?flow= from the URL so a dead flow does not return on reload. */
  function forgetFlowInLocation() {
    if (typeof window === 'undefined') return
    const url = new URL(window.location.href)
    if (!url.searchParams.has('flow')) return
    url.searchParams.delete('flow')
    window.history.replaceState({}, '', url)
  }

  async function restart(why: KratosNotice | null = null) {
    forgetFlowInLocation()
    pending.value = true
    failed.value = false
    // Kept: a restart from a dead flow emptied the fields and shows why.
    notice.value = why
    try {
      load(await createFlow())
    }
    catch (err) {
      if (err instanceof AlreadySignedIn) {
        notice.value = 'signedIn'
        return
      }
      if (err instanceof NotSignedIn) {
        notice.value = 'signedOut'
        return
      }
      failed.value = true
      notice.value = 'unreachable'
    }
    finally {
      if (!leaving.value) pending.value = false
    }
  }

  /** The flow the URL names while it is alive, otherwise a fresh one. */
  async function readOrCreateFlow(id: string): Promise<KratosFlow> {
    try {
      return await readFlow(id)
    }
    catch {
      forgetFlowInLocation()
      return await createFlow()
    }
  }

  async function start() {
    pending.value = true
    failed.value = false

    try {
      // ?flow= arrives from flows started outside the app, such as OIDC returns.
      const id = flowIdFromLocation()
      load(id ? await readOrCreateFlow(id) : await createFlow())
    }
    catch (err) {
      // Reported, not navigated: where a signed-in user belongs is the app's call.
      if (err instanceof AlreadySignedIn) {
        notice.value = 'signedIn'
        return
      }
      // No session, on a flow that needs one.
      if (err instanceof NotSignedIn) {
        notice.value = 'signedOut'
        return
      }
      // Stale flows were replaced above, so this is Kratos being unreachable.
      failed.value = true
      notice.value = 'unreachable'
    }
    finally {
      if (!leaving.value) pending.value = false
    }
  }

  /** The one navigation left: landing somewhere with a session in hand. */
  function finish(body: KratosSuccess) {
    // The page is on its way out. Everything else keeps showing the spinner
    // rather than flashing a form nobody is going to fill in.
    leaving.value = true
    if (typeof window === 'undefined') return
    const to = body.continue_with?.find(
      c => c.action === 'redirect_browser_to',
    )?.redirect_browser_to
    // `||`, not `??`. An app with no return_to in the URL passes "", and an
    // empty href means "this page again" - which on a screen that leaves
    // because you are already signed in is an infinite reload, not a
    // destination.
    // Anything Kratos redirects to on success is this app - a return_to it
    // already checked, or one of its own UI URLs - so the host is dropped
    // whatever the path. A hand-off elsewhere arrives on a 422 or 403 instead,
    // and submit() follows that one untouched.
    window.location.href = onThisOrigin(to ?? '') || options.returnTo || '/'
  }

  async function submit(form: HTMLFormElement, submitter?: Element | null) {
    if (!flow.value || submitting.value) return
    // Rewritten only under the proxied path; an OIDC provider action is left alone.
    const action = onThisOrigin(flow.value.ui.action, true)

    notice.value = null
    submitting.value = true
    try {
      // The submitter adds the clicked button's name/value, which Kratos needs.
      const body = new URLSearchParams()
      for (const [key, value] of new FormData(
        form,
        submitter as HTMLElement | null,
      )) {
        if (typeof value === 'string') body.append(key, value)
      }

      const res = await ask(action, { method: 'POST', body })

      // Next steps and validation failures both arrive as the flow with 400.
      if (res.status === 400) {
        load((await res.json()) as KratosFlow)
        return
      }
      // 422 is a hand-off (OIDC, second factor); 403 with redirect_browser_to is
      // session_refresh_required. A stale CSRF 403 carries no redirect.
      if (res.status === 422 || res.status === 403) {
        const { redirect_browser_to: to } = ((await res.json().catch(() => null)) ?? {}) as {
          redirect_browser_to?: string
        }
        if (typeof window !== 'undefined' && to) {
          // The page is leaving, so nothing re-renders a form behind the
          // navigation - the same promise finish() makes.
          leaving.value = true
          window.location.href = to
          return
        }
        if (res.status === 422) return
      }
      // Gone, unknown, or refused: restart at once and say the form expired.
      if ([403, 404, 410].includes(res.status)) {
        await restart('expired')
        return
      }
      if (!res.ok) throw new Error(`kratos submit ${res.status}`)

      finish((await res.json()) as KratosSuccess)
    }
    catch {
      // Offline, refused, or past the deadline; the flow itself may be fine.
      failed.value = true
      notice.value = 'unreachable'
    }
    finally {
      submitting.value = false
    }
  }

  const nodes = computed(() => flow.value?.ui.nodes ?? [])

  return {
    flow,
    values,
    pending,
    failed,
    notice,
    submitting,
    nodes,
    inputs: computed(() => nodes.value.filter(isKratosInput)),
    hidden: computed(() => nodes.value.filter(isKratosHidden)),
    submits: computed(() => nodes.value.filter(isKratosSubmit)),
    messages: computed(() => flow.value?.ui.messages ?? []),
    messagesFor: (name: string) =>
      nodes.value.find(n => n.attributes.name === name)?.messages ?? [],
    start,
    restart,
    submit,
  }
}
