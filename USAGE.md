# Using s99ab

A Go module and a Nuxt layer, versioned together. Use the same version of
both: layer 1.2 with module 1.1 means the client and server disagree about the
error envelope.

## Credentials

Set both lines. `GOPRIVATE` alone moves the module off the proxy to direct git
over https, which has no credentials.

```sh
go env -w GOPRIVATE='github.com/smegg99/*'
git config --global url."ssh://git@github.com/smegg99/".insteadOf "https://github.com/smegg99/"
```

## Go

```sh
go get github.com/smegg99/s99ab@v1.0.0
```

| Import | What |
| --- | --- |
| `api/apierr` | one error envelope; the cause goes to the log, not the response |
| `api/apihealth` | `/health`, `/ready`, `/version` |
| `api/apimount` | API middleware in a fixed order |
| `api/apipage` | `page`, `limit`, `sort`, `q`, and a whitelisted `ORDER BY` |
| `api/apiquery` | a scalar parameter, query first, body as fallback |
| `auth/kratosauth`, `auth/keto` | identity and per-object permissions |
| `data/db` | SQLite or Postgres with the needed pragmas, goose migrations |
| `data/outbox` | work that must survive a crash |
| `data/storage` | content-addressed objects, local dir or S3 |
| `mail/mailer`, `mail/mailcatch` | sending, and reading a mailbox back |
| `net/sse` | one long-lived response per client, no router imported |
| `net/httpmw` | rate limits and request size caps |
| `net/netprobe` | host reachability: unprivileged ICMP, then TCP connect |
| `release/releases`, `release/ghreleases`, `api/apireleases` | a GitHub release list as a download page's model |
| `work/applife` | shutdown in reverse construction order |
| `work/jobs` | scheduled work in-process |
| `work/daemon` | unix-socket HTTP, and starting the process when it is down |
| `common/pool` | work items through bounded goroutines, results in order |
| `common/ttlcache` | one value behind a TTL, concurrent misses collapse |

## Nuxt layer

Not on npm. Pin the tag:

```json
"@smegg99/s99ab": "git+ssh://git@github.com/smegg99/S99AB.git#v1.0.0"
```

The app installs the peers. The layer imports `vue-router`, adds its `.scss`
to the app's Vite pipeline, and uses `mdi-` icons:

```sh
pnpm add nuxt vue vue-router vuetify pinia @pinia/colada sass-embedded @mdi/font
```

`zod`, `@firecms/neat` and `vue-i18n` are optional; each helper falls back when
its peer is absent.

```ts
// nuxt.config.ts
export default defineNuxtConfig({ extends: ['@smegg99/s99ab'] })
```

```ts
// app/plugins/vuetify.ts - all of an app's theming
import { s99abTheme } from '@smegg99/s99ab/theme'
createVuetify({ components, directives, ...s99abTheme({ accent: '#c73378' }) })
```

```ts
import { withS99ab } from '@smegg99/s99ab/i18n'
createI18n({ globalInjection: true, messages: withS99ab({ en, pl }) })
```

`globalInjection` is required: `useTranslate` reads `$t` from the app context,
and without it every layer string renders as its key.

## Contracts

The app's OpenAPI document `$ref`s the shared fragments and is bundled before
client generation, because the generator reads the bundle:

```yaml
$ref: 'node_modules/@smegg99/s99ab/contracts/schemas/error.yaml#/Error'
$ref: 'node_modules/@smegg99/s99ab/contracts/parameters/pagination.yaml#/Page'
```

## Runtime

Kratos `v1.3.1` and Keto `v0.14.0`. Setting all three auth URLs enables
identity. Setting none disables it, and the guarded routes are not mounted.
Setting only some of the three is rejected at boot.

## Local development

Use `"@smegg99/s99ab": "link:../S99AB"` and `replace github.com/smegg99/s99ab =>
../S99AB`. Do not release with either; a release pins tags.
