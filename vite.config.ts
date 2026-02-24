/// <reference types="vitest" />
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  test: {
    setupFiles: ['./src/testing/setupReactAct.ts'],
  },
  server: {
    port: 5173,
    hmr: {
      port: 5173,
    }
  },
});
