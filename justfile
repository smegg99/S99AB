# List available commands.
default:
    @just --list

# Check both halves without rewriting source files.
check: check-fmt vet test lint typecheck test-web check-version check-locales contracts check-package

# Release gate, including disposable services and a real Nuxt browser consumer.
release-check: check test-services test-browser audit

# Format all Go files.
fmt:
    gofmt -l -w .

# Fail on unformatted Go files without changing them.
check-fmt:
    @files=$(gofmt -l .); test -z "$files" || { printf '%s\n' "$files"; exit 1; }

# Run go vet.
vet:
    go vet ./...

# Run all tests.
test:
    go test -race ./...

# Lint and check formatting on the web half.
lint:
    pnpm lint

# Apply eslint autofixes.
fix:
    pnpm lint --fix

# Typecheck the Nuxt layer on its own.
typecheck:
    pnpm typecheck

# Run the layer's vitest suite.
test-web:
    pnpm test

# Set the version and sync generated metadata.
set-version ver:
    node scripts/sync-version.mjs "{{ver}}"

# Fail when package.json differs from VERSION. Both halves ship as one version.
check-version:
    node scripts/sync-version.mjs --check

# Rebuild web/src/assets/fonts from fontsource's Overpass with fixed vertical
# metrics and spacing marks made bases. Needs Python 3 with fontTools and brotli.
fonts:
    python3 scripts/overpass-metrics.py

# Regenerate the runtime locales from their canonical source with S99Locale.
locales:
    go run github.com/smegg99/s99locale/cmd/loc@v1.1.0 build -c web/i18n/config.cue

# Fail when generated locales differ from their source or the languages
# disagree on keys.
check-locales:
    go run github.com/smegg99/s99locale/cmd/loc@v1.1.0 check -c web/i18n/config.cue

# Lint the shared contract fragments against a probe document.
contracts:
    pnpm exec redocly lint contracts/probe.yaml

# Validate published paths, licenses and exclusions without creating a tarball.
check-package:
    node scripts/check-package.mjs

# PostgreSQL, SeaweedFS, Keto and Kratos on random loopback ports; removed afterwards.
test-services:
    python3 scripts/test-services.py

# Build the SSR consumer, then use a fresh Chromium profile on an owned virtual display.
test-browser:
    pnpm exec nuxt build tests/consumer
    pnpm exec vue-tsc --noEmit -p tests/consumer/.nuxt/tsconfig.app.json
    xvfb-run -a -s '-screen 0 1440x1100x24' pnpm exec playwright test --config tests/browser/playwright.config.ts --headed

# Keep all severities visible; unresolved advisories fail the release gate.
audit:
    go run golang.org/x/vuln/cmd/govulncheck@v1.9.0 ./...
    pnpm audit
