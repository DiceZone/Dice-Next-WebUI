import { defineConfig } from '@playwright/test';

export default defineConfig({
  testDir: './tests/browser', testMatch: 'mcp.spec.mjs', fullyParallel: false,
  forbidOnly: !!process.env.CI, retries: 0, workers: 1, timeout: 30000,
  reporter: 'list', outputDir: 'test-results/mcp',
  globalSetup: './tests/browser/setup-mcp.mjs',
  use: { baseURL: 'http://127.0.0.1:43191', channel: process.env.PLAYWRIGHT_CHANNEL || undefined, headless: true, viewport: { width: 1280, height: 900 },
    // No real keys or personal data: this suite talks only to an in-memory fixture.
    screenshot: 'only-on-failure', trace: 'retain-on-failure', serviceWorkers: 'block' },
});
