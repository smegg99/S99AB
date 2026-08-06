# S99AB

Shared application code for smegg99 apps: one Go module and one Nuxt layer,
versioned together.

Built with Go 1.27, Gin, Nuxt 4, Vue 3, Vuetify 4 and Pinia Colada.

```
go.mod:      github.com/smegg99/s99ab
nuxt.config: extends: ['@smegg99/s99ab']
```

[USAGE.md](USAGE.md) shows how an app imports both halves.

## Go packages

| Package | What it does |
| --- | --- |
| `api/apierr` | One error envelope for every failing status, matching `contracts/schemas/error.yaml`. The cause goes to the log, not the response. |
| `api/apihealth` | Serves `/health`, `/ready` and `/version`. |
| `api/apimount` | Mounts API middleware in a fixed order: one rate limiter above everything, health before authentication, `Session` before any subgroup, separate size caps for JSON and uploads (the caps cannot nest). |
| `api/apipage` | Parses and clamps `page`, `limit`, `sort` and `q` from `contracts/parameters/pagination.yaml`, and builds `ORDER BY` from a whitelist. |
| `api/apiquery` | Reads a scalar parameter from the query, with the body as fallback. |
| `auth/kratosauth`, `auth/keto` | Identity from Ory Kratos, per-object permissions from Ory Keto. |
| `data/db` | Opens SQLite or Postgres with the needed pragmas; runs goose migrations as a library. |
| `data/outbox` | Work that must survive a crash, enqueued in the same transaction as the business change. |
| `data/storage` | Content-addressed objects in a local directory or an S3-compatible bucket. |
| `mail/mailer`, `mail/mailcatch` | Sending mail, and reading a mailbox back. |
| `net/sse` | Server events to many `EventSource` clients, one long-lived response each. Imports no router, so a desktop app can stream through its asset server without Gin. |
| `net/httpmw` | Rate limits and request size caps. |
| `net/netprobe` | Host reachability: unprivileged ICMP, then TCP connect. |
| `release/ghreleases`, `release/releases`, `api/apireleases` | A GitHub release list as a download page's model. |
| `work/applife` | Shutdown in reverse construction order. A server that fails to bind stops the process instead of reporting healthy. |
| `work/jobs` | Scheduled (cron) work in-process. |
| `work/daemon` | HTTP over a unix socket, and starting the process when it is down. |
| `common/pool` | Work items through bounded goroutines, results in order. |
| `common/ttlcache` | One value behind a TTL; concurrent misses collapse into one fetch. |

## Nuxt layer

Dialogs, toasts, server-paged tables, a folder explorer, keyboard shortcuts,
motion, and loading, error and empty states. `useEventSource` wraps the
browser's `EventSource` for the stream `net/sse` serves. `UiAsync` picks
between first load, failure, empty and content. `UiAppShell` and `UiPanel` are
the page frame. The palette, component defaults and stylesheet live in the
layer, so an app sets only its accent colour.

Both halves share the error and pagination contracts and ship as one version.
An app on layer 1.2 and module 1.1 gets a generated client and a server that
disagree about the error envelope.

## Prerequisites

- Go 1.27+. No CGO: the SQLite driver is `modernc.org/sqlite`.
- Node.js and pnpm 11+
- [just](https://github.com/casey/just)
- [`loc`](https://github.com/smegg99/S99Locale) (S99Locale) for the locales:
  `go install github.com/smegg99/s99locale/cmd/loc@latest`. `just locales`
  regenerates `web/i18n/generated`, `just check` runs `loc check`.

## Usage

This is a library and a layer; an app depends on it.

Both halves are private and not on a public registry. A machine that builds
against them needs both of these settings:

```sh
go env -w GOPRIVATE='github.com/smegg99/*'
git config --global url."ssh://git@github.com/smegg99/".insteadOf "https://github.com/smegg99/"
```

`GOPRIVATE` alone moves the module off the public proxy to direct git over
https, which has no credentials and fails.

```sh
go get github.com/smegg99/s99ab
```

The layer is not on npm. Depend on a checkout beside the app:

```json
"@smegg99/s99ab": "link:../S99AB"
```

or pin a release with `git+ssh://git@github.com/smegg99/S99AB.git#<tag>`.

The app installs the peer dependencies. The layer imports `vue-router`, adds
its `.scss` to the app's Vite pipeline, and uses `mdi-` icons:

```sh
pnpm add nuxt vue vue-router vuetify pinia @pinia/colada sass-embedded @mdi/font
```

`zod`, `@firecms/neat` and `vue-i18n` are optional. The validation helpers, the
animated background and the translated strings each fall back when their peer
is absent.

```ts
// nuxt.config.ts
export default defineNuxtConfig({
  extends: ['@smegg99/s99ab'],
})
```

```ts
// app/plugins/vuetify.ts - all of an app's theming
import { s99abTheme } from '@smegg99/s99ab/theme'

createVuetify({ components, directives, ...s99abTheme({ accent: '#c73378' }) })
```

The layer ships the messages its own components use. `withS99ab` merges them
under the app's messages; the app's keys win:

```ts
import { withS99ab } from '@smegg99/s99ab/i18n'

createI18n({ globalInjection: true, messages: withS99ab({ en, pl }) })
```

`globalInjection` is required: `useTranslate` reads `$t` from the app context,
and without it every layer string renders as its key.

An app's OpenAPI contract `$ref`s the shared fragments and is bundled before
client generation, because the generator reads the bundle:

```yaml
$ref: 'node_modules/@smegg99/s99ab/contracts/schemas/error.yaml#/Error'
$ref: 'node_modules/@smegg99/s99ab/contracts/parameters/pagination.yaml#/Page'
```

## Development

```sh
just check          # gofmt, vet, go test, eslint, vue-tsc, vitest, version + locale parity
just fix            # apply eslint autofixes
just contracts      # lint the shared contract fragments against a probe document
just locales        # regenerate the runtime locales from their YAML source
just set-version 1.1.0
```

`VERSION` is the source of truth; `just check-version` fails when
`package.json` differs from it.

## License

MIT. See [LICENSE](LICENSE).
