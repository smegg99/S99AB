// scripts/sync-version.mjs
//
// Syncs package.json to VERSION, or checks they match with --check.

import { readFileSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')
const versionFile = join(root, 'VERSION')
const manifest = join(root, 'package.json')

const semver = /^\d+\.\d+\.\d+(?:-[0-9A-Za-z.-]+)?$/

const check = process.argv.includes('--check')
const given = process.argv[2] && !process.argv[2].startsWith('--') ? process.argv[2] : null

const version = given ?? readFileSync(versionFile, 'utf8').trim()

if (!semver.test(version)) {
  fail(`"${version}" is not MAJOR.MINOR.PATCH`)
}

const pkg = JSON.parse(readFileSync(manifest, 'utf8'))

if (check) {
  const onDisk = readFileSync(versionFile, 'utf8').trim()
  if (pkg.version !== onDisk) {
    fail(`VERSION is ${onDisk} but package.json is ${pkg.version}`)
  }
  console.log(`version ${onDisk}`)
  process.exit(0)
}

// Written before package.json: a crash in between leaves --check failing.
writeFileSync(versionFile, `${version}\n`)

pkg.version = version
writeFileSync(manifest, `${JSON.stringify(pkg, null, 2)}\n`)

console.log(`version ${version}`)

function fail(message) {
  console.error(`sync-version: ${message}`)
  process.exit(1)
}
