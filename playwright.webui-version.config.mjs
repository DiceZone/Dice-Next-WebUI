import { defineConfig } from '@playwright/test';
export default defineConfig({
  testDir: './tests/browser', testMatch: 'webui-version.spec.mjs', fullyParallel: false,
  forbidOnly: !!process.env.CI, retries: 0, workers: 1, timeout: 30000,
  reporter: 'list', outputDir: 'test-results/webui-version', globalSetup: './tests/browser/setup-webui-version.mjs',
  use: { baseURL: 'http://127.0.0.1:43193', channel: process.env.PLAYWRIGHT_CHANNEL || undefined, headless: true,
    viewport: { width: 1366, height: 900 }, screenshot: 'only-on-failure', trace: 'retain-on-failure', serviceWorkers: 'block' },
});
