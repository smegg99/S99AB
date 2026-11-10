// tests/browser/playwright.config.ts
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { defineConfig } from '@playwright/test'

const port = Number(process.env.S99AB_TEST_PORT || 31991)
export default defineConfig({
  testDir: '.',
  outputDir: process.env.S99AB_BROWSER_ARTIFACTS || join(tmpdir(), 's99ab-browser-results'),
  workers: 1,
  use: {
    baseURL: `http://127.0.0.1:${port}`,
    browserName: 'chromium',
    launchOptions: { args: ['--ozone-platform=x11', '--disable-sync', '--no-first-run', '--no-default-browser-check'] },
    reducedMotion: 'reduce',
  },
  webServer: {
    command: 'node tests/consumer/.output/server/index.mjs',
    cwd: '../..',
    env: { PORT: String(port), HOST: '127.0.0.1' },
    url: `http://127.0.0.1:${port}`,
    reuseExistingServer: false,
    timeout: 30000,
  },
})
