/// <reference types="vitest" />
import { configDefaults, defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';
import { playwright } from '@vitest/browser-playwright';

export default defineConfig({
  plugins: [react()],
  test: {
    projects: [
      {
        extends: true,
        test: {
          name: 'unit',
          setupFiles: ['./src/testing/setupReactAct.ts'],
          environment: 'jsdom',
          exclude: [...configDefaults.exclude, 'src/**/*.interaction.browser.test.tsx'],
        },
      },
      {
        extends: true,
        test: {
          name: 'interaction-browser',
          setupFiles: ['./src/testing/setupReactAct.ts'],
          include: ['src/**/*.interaction.browser.test.tsx'],
          browser: {
            enabled: true,
            provider: playwright(),
            headless: true,
            instances: [{ browser: 'chromium' }],
          },
        },
      },
    ],
  },
  server: {
    port: 5173,
    hmr: {
      port: 5173,
    }
  },
});
