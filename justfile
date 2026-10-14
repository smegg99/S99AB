# List available commands.
default:
    @just --list

# Format, vet and test everything, both halves.
check: fmt vet test lint typecheck test-web check-version check-locales

# Format all Go files.
fmt:
    gofmt -l -w .

# Run go vet.
vet:
    go vet ./...

# Run all tests.
test:
    go test ./...

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
    loc build -c web/i18n/config.cue

# Fail when generated locales differ from their source or the languages
# disagree on keys.
check-locales:
    loc check -c web/i18n/config.cue

# Lint the shared contract fragments against a probe document.
contracts:
    pnpm --package=@redocly/cli dlx redocly lint contracts/probe.yaml
