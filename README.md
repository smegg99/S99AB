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

## Development

```sh
just check
```

That runs formatting, vet/tests, ESLint, Vue typechecking, Vitest, version parity
and locale parity.

## License

MIT. See [LICENSE](LICENSE).
