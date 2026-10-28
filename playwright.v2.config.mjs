import { defineConfig } from '@playwright/test';
export default defineConfig({
  testDir: './tests/browser', testMatch: 'v2.spec.mjs', fullyParallel: true,
  forbidOnly: !!process.env.CI, retries: 0, workers: 2, timeout: 30000,
  reporter: 'list', outputDir: 'test-results/v2', globalSetup: './tests/browser/setup-v2.mjs',
  projects: [
    { name: 'desktop', use: { viewport: { width: 1440, height: 1000 } } },
    { name: 'mobile', use: { viewport: { width: 390, height: 844 } } },
    { name: 'dark', use: { viewport: { width: 1366, height: 900 }, colorScheme: 'dark' } },
  ],
  use: { baseURL: 'http://127.0.0.1:43197', channel: process.env.PLAYWRIGHT_CHANNEL || undefined,
    headless: true, screenshot: 'only-on-failure', trace: 'retain-on-failure', serviceWorkers: 'block' },
});
