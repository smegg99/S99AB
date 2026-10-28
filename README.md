# S99AB

Shared application foundation for smegg99 apps.

S99AB ships a Go module and a Nuxt 4 layer as one versioned unit. Apps reuse the
same API conventions, persistence helpers, auth integration, background work,
storage, application shell and UI behaviour instead of rebuilding them.

```text
go.mod:       github.com/smegg99/s99ab
nuxt.config:  extends: ['@smegg99/s99ab']
```

Built with Go 1.27, Gin, Nuxt 4, Vue 3, Vuetify 4 and Pinia Colada.

## What is here

### Go

- API: shared errors, health/readiness/version endpoints, API mounting,
  pagination, scalar query helpers and release endpoints.
- Auth: Ory Kratos identity/session integration and Ory Keto object
  permissions.
- Data: SQLite/Postgres setup and migrations, transactional outbox work,
  local/S3-compatible object storage and image handling.
- Mail: SMTP delivery/templates and IMAP verification-code capture.
- Networking: rate limits, request-size caps, host probes and framework-free
  Server-Sent Events.
- Releases: GitHub Releases ingestion, localized Markdown notes and
  application-facing download models.
- Work: graceful application lifetime, cron jobs and Unix-socket daemons.
- Common: bounded worker pools and last-good-value TTL caching.

### Nuxt

- Application shell, navigation, page and panel primitives.
- Loading, error, empty and signed-out states.
- Dialogs, prompts, confirms and toast queues.
- URL-synced server-side tables.
- Capability-driven file explorer.
- Workspace tabs, navigation history, pointer drag and context menus, with
  optional native window hooks.
- Ory Kratos self-service flow UI.
- Release/download/update UI.
- Markdown rendering and lightweight syntax highlighting.
- Keyboard shortcuts, motion and auto-height transitions.
- Shared palettes, Vuetify defaults, textures and appearance preferences.
- Browser `EventSource` integration.
- English/Polish layer-localized strings and validation helpers.

The Go and Nuxt halves share the same error and pagination contracts and are
therefore released together.

## Quick start

The repository is private. Configure Go and git together:

```sh
go env -w GOPRIVATE='github.com/smegg99/*'
git config --global url."ssh://git@github.com/smegg99/".insteadOf "https://github.com/smegg99/"
```

Install the Go module:

```sh
go get github.com/smegg99/s99ab
```

Consume the Nuxt layer from a sibling checkout:

```json
{
  "@smegg99/s99ab": "link:../S99AB"
}
```

```ts
export default defineNuxtConfig({
  extends: ['@smegg99/s99ab'],
})
```

## Subpaths

Inside a Nuxt app the layer auto-imports its `use*`, `provide*` and `dispose*`
composables and their types, nothing else. Plain functions, and code outside
Nuxt such as a desktop bridge, import from a subpath:

| Subpath | Holds |
|---|---|
| `@smegg99/s99ab/browser` | focus, pointer tracking and drag, tiles, edit undo, text fitting, `takeRow`, `createPendingSaves`, `prefersReducedMotion` |
| `@smegg99/s99ab/explorer` | tree helpers (`pathOf`, `groupByParent`, `childrenOf`, ...), `bindExplorerEvents`, explorer types |
| `@smegg99/s99ab/kratos` | node helpers, `kratosRules`, `kratosMessageText`, sign-out and refresh, sign-in routes, Kratos types |
| `@smegg99/s99ab/appearance` | `useAppearance`, the appearance source, textures, `supportsWebgl`, `originOf` |
| `@smegg99/s99ab/releases` | `formatBytes`, `kindKey`, `PLATFORM_NAMES`, `compareVersions`, `formatReleaseDate` |
| `@smegg99/s99ab/markdown` | `parseMarkdown`, `parseInline`, `tokenise` |
| `@smegg99/s99ab/state` | `settle`, `toApiError` |
| `@smegg99/s99ab/tabs` | `useTabs`, the tab context menu, native tab drag types |
| `@smegg99/s99ab/theme` | palettes and Vuetify theme helpers |
| `@smegg99/s99ab/types` | every type in a public signature |
| `@smegg99/s99ab/i18n` | the layer's catalogs |
| `@smegg99/s99ab/styles` | the shared stylesheet |

## Upgrading the Nuxt layer after 1.7.0

The auto-import surface shrank from about 250 names to the composables. A
consumer that used one of these as a global imports it from the subpath above:
`pathOf`, `groupByParent`, `childrenOf`, `depthOf`, `bindExplorerEvents`,
`createPointerDrag`, `inZone`, `fitWordRun`, `isCut`, `wordBoxes`, `wordsRoom`,
`takeRow`, `originOf`, `registerAppearanceSource`, `resetAppearanceSource`,
`TEXTURES`, `applyTexture`, `textureConfig`, `supportsWebgl`, `formatBytes`,
`kindKey`, `parseMarkdown`, `prefersReducedMotion`, `settle`. Renamed:
`injectKeyTips` is `useKeyTipsContext`, `pendingSaves` is `createPendingSaves`.
`/browser` no longer re-exports composables; they are auto-imported. Toast
functions (`show`, `dismiss`, `promise`, ...) are only on `useToast()`.

## Upgrading to 1.7.0

1.7.0 breaks these Go APIs:

- `auth/kratosauth` keeps the Kratos client. The Gin middleware moved to
  `auth/kratosgin`: `Session`, `Require`, `RequireFunc`, `RequireMeta`, `From`
  and `MustFrom`.
- `kratosauth.Client.Whoami` answers `ErrNoSession` without calling Kratos when
  the request has no cookie, session token or Authorization header.
- `db.Open(ctx, cfg)`, `db.Migrate(ctx, ...)` and `db.MigrateDown(ctx, ...)`
  take a context. `db.Detect(conn)` takes no context and returns an error for an
  unknown driver.
- `outbox.Worker.Start` and `jobs.Scheduler.Start` return an error, `ErrClosed`
  after `Close`. Outbox timestamps use a fixed-width UTC layout.
- `storage.Key` returns an error unless it gets a SHA-256 hex digest.
- `apipage.Order` always ends with the fallback's columns.
- `daemon.Listen` refuses a path that holds anything but a socket.

These keep their signatures but behave differently:

- `kratosauth.Client.Whoami` looks for the session cookie by name
  (`Options.SessionCookie`, default `ory_kratos_session`, plus Ory Network's
  `ory_session_*`). Other cookies alone are no session. `kratosauthtest.Fake`
  maps that cookie's value, not the whole `Cookie` header.
- Keto `Delete`, `Subjects` and `Objects` return `ErrSelector` for an empty
  field instead of matching everything.
- `storage.Sanitise` and `storage.Derive` return `ErrTooLarge` for an image
  over `MaxPixels` (40 megapixels).
- The Kratos admin and flow clients default to a 10 s timeout.
- `outbox.Worker.Drain` returns results it could not record, and a panicking
  handler counts as a failed attempt.
- `sse.WriteEvent` returns `ErrField` for a line break in an id or event type,
  and `ErrEncode` for data it cannot encode; the handler skips such events.

## Development

```sh
just check
```

That runs formatting, vet/tests, ESLint, Vue typechecking, Vitest, version parity
and locale parity.

## License

MIT. See [LICENSE](LICENSE).
