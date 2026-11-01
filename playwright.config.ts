import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  testDir: './tests/e2e',
  fullyParallel: false,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: 1,
  reporter: [
    ['html', { outputFolder: 'playwright-report' }],
    ['list'],
  ],
  use: {
    baseURL: 'http://localhost:8787',
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
    video: 'on',
  },
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
  ],
  webServer: [
    {
      command: 'pnpm --filter @obscurus/platform dev',
      url: 'http://localhost:8787/health',
      timeout: 30000,
      reuseExistingServer: !process.env.CI,
    },
    {
      command: 'pnpm --filter @obscurus/dashboard dev',
      url: 'http://localhost:3001',
      timeout: 30000,
      reuseExistingServer: !process.env.CI,
    },
    {
      command: 'pnpm --filter @obscurus/checkout dev',
      url: 'http://localhost:3000',
      timeout: 30000,
      reuseExistingServer: !process.env.CI,
    },
  ],
});
