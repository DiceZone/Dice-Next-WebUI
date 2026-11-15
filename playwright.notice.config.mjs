import { defineConfig } from '@playwright/test';
export default defineConfig({
  testDir: './tests/browser', testMatch: 'notice.spec.mjs', fullyParallel: false,
  forbidOnly: !!process.env.CI, retries: 0, workers: 1, timeout: 30000,
  reporter: 'list', outputDir: 'test-results/notice', globalSetup: './tests/browser/setup-preview.mjs',
  use: { channel: process.env.PLAYWRIGHT_CHANNEL || undefined, headless: true, viewport: { width: 1366, height: 900 },
    screenshot: 'only-on-failure', trace: 'retain-on-failure', serviceWorkers: 'block' },
});
