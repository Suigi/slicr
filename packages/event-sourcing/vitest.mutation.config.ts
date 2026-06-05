import {playwright} from '@vitest/browser-playwright';
import {defineConfig} from 'vitest/config';

export default defineConfig({
  define: {
    __STRYKER_ACTIVE_MUTANT__: JSON.stringify(process.env.__STRYKER_ACTIVE_MUTANT__ ?? ''),
  },
  test: {
    projects: [
      {
        extends: true,
        test: {
          name: 'node',
          include: ['src/**/*.test.ts'],
          exclude: ['src/**/*.browser.test.ts'],
        },
      },
      {
        extends: true,
        test: {
          name: 'browser',
          setupFiles: ['src/_setup/strykerBrowserSetup.ts'],
          include: ['src/**/*.browser.test.ts'],
          browser: {
            enabled: true,
            provider: playwright(),
            headless: true,
            instances: [{browser: 'chromium'}],
          },
        },
      },
    ],
  },
});
