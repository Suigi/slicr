import {playwright} from '@vitest/browser-playwright';
import {defineConfig} from 'vitest/config';

export default defineConfig({
  define: {
    __STRYKER_ACTIVE_MUTANT__: JSON.stringify(process.env.__STRYKER_ACTIVE_MUTANT__ ?? ''),
  },
  test: {
    setupFiles: ['src/_setup/strykerBrowserSetup.ts'],
    include: ['src/**/*.browser.test.ts'],
    browser: {
      enabled: true,
      provider: playwright(),
      headless: true,
      instances: [{browser: 'chromium'}],
    },
  },
});
