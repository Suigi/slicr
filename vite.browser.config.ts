/// <reference types="vitest" />
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  test: {
    name: 'interaction-browser',
    setupFiles: ['./src/testing/setupReactAct.ts'],
    include: ['src/**/*.interaction.browser.test.tsx'],
    browser: {
      enabled: true,
      provider: 'playwright',
      instances: [{ browser: 'chromium' }],
    },
  },
});
