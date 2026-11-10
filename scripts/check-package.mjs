// scripts/check-package.mjs
import assert from 'node:assert/strict'
import { execFileSync } from 'node:child_process'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'

const root = fileURLToPath(new URL('../', import.meta.url))
const pkg = JSON.parse(readFileSync(new URL('../package.json', import.meta.url), 'utf8'))
const [pack] = JSON.parse(execFileSync('npm', ['pack', '--dry-run', '--json', '--ignore-scripts'], { cwd: root, encoding: 'utf8' }))
const paths = new Set(pack.files.map(file => file.path))
for (const entry of Object.values(pkg.exports)) assert(paths.has(entry.replace(/^\.\//, '')), `missing export: ${entry}`)
for (const entry of ['LICENSE', 'README.md', 'web/src/assets/fonts/OFL.txt']) assert(paths.has(entry), `missing notice: ${entry}`)
for (const path of paths) {
  assert(!/(^|\/)(tests|node_modules|\.nuxt|\.output)(\/|$)|\.(spec|test)\./.test(path), `unexpected package file: ${path}`)
}
assert.equal(pkg.license, 'MIT')
console.log(`package: ${paths.size} files; all exports and license notices present`)
