import {defineConfig, devices} from '@playwright/test';

const port = 4179;

export default defineConfig({
  testDir: './e2e',
  timeout: 30_000,
  expect: {timeout: 8_000},
  workers: process.env.CI ? 1 : 2,
  retries: process.env.CI ? 1 : 0,
  outputDir: './test-results',
  reporter: 'list',
  use: {
    ...devices['Desktop Chrome'],
    baseURL: `http://127.0.0.1:${port}`,
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
  },
  webServer: {
    command: `npm run dev -- --host 127.0.0.1 --port ${port} --strictPort`,
    url: `http://127.0.0.1:${port}`,
    reuseExistingServer: false,
    timeout: 30_000,
  },
});
