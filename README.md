# S99AB

Shared application code for smegg99 apps: one Go module and one Nuxt layer,
versioned together.

Built with Go 1.27, Gin, Nuxt 4, Vue 3, Vuetify 4 and Pinia Colada.

```
go.mod:      github.com/smegg99/s99ab
nuxt.config: extends: ['@smegg99/s99ab']
```

## What It Does

The Go half answers the questions every HTTP service has to answer the same
way. `apierr` is one error envelope for every failing status, matching
`contracts/schemas/error.yaml` exactly, and it hides the cause from the
response while handing it to the log. `apihealth` serves `/health`, `/ready`
and `/version`. `apimount` wires the middleware an API group needs in the order
that is easy to get wrong - one rate limiter above everything, health before
authentication, `Session` mounted before any subgroup is created, and separate
size caps for JSON and uploads because the caps cannot nest. `applife` owns
shutdown in reverse construction order and races the server's own failure
against the shutdown signal, so a process that could not bind stops instead of
sitting there reporting healthy.

`apipage` is the Go side of `contracts/parameters/pagination.yaml`: it parses
and clamps `page`, `limit`, `sort` and `q`, and builds an `ORDER BY` clause
from a whitelist rather than from the request. `db` opens SQLite or Postgres
with the pragmas that are wrong by default, and migrates through goose as a
library. `jobs` runs cron work, `outbox` runs work that must survive a crash by
enqueueing in the same transaction as the business change. `storage` puts
content-addressed objects in a local directory or an S3-compatible bucket
behind one interface. `sse` fans server events out to many `EventSource`
clients, one long-lived response each, and imports no router - a desktop app
streams progress through its asset server without linking Gin. `kratosauth` and
`keto` resolve identity and per-object
permissions from Ory. `ghreleases`, `releases` and `apireleases` turn a GitHub
release list into a download page's model.

The Nuxt layer supplies the look and the interaction primitives: dialogs,
toasts, server-paged tables, a folder explorer, keyboard shortcuts, motion, a
`useEventSource` that wraps the browser's own `EventSource` for the stream `sse`
serves, and the loading, error and empty states. `UiAsync` resolves the four-way branch a
screen would otherwise write by hand - first load, failure, nothing to show,
content. `UiAppShell` and `UiPanel` are the frame, and the palette, component
defaults and stylesheet all live here, so an app writes no CSS and differs only
in its accent colour.

Both halves ship as one version. They share the error and pagination
contracts, so an app on layer 1.2 and module 1.1 is an app whose generated
client and its server disagree about the envelope.

## Prerequisites

- Go 1.26+. No CGO: the SQLite driver is `modernc.org/sqlite`, pure Go.
- Node.js and pnpm 11+
- [just](https://github.com/casey/just)
- [`loc`](https://github.com/smegg99/S99Locale) (S99Locale) for the locales:
  `go install github.com/smegg99/s99locale/cmd/loc@latest`. `just locales`
  regenerates `web/i18n/generated`, `just check` runs `loc check`.

## Usage

This is a library and a layer. It is not run on its own - an app depends on it.

```sh
go get github.com/smegg99/s99ab
pnpm add @smegg99/s99ab
```

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
