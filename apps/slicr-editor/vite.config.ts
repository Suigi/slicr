/// <reference types="vitest" />
import {configDefaults, defineConfig} from 'vitest/config';
import react from '@vitejs/plugin-react';
import * as path from 'node:path';
import * as os from 'node:os';

export default defineConfig(({mode}) => ({
  plugins: [react()],
  ...(mode === 'project'
    ? {build: {outDir: 'dist-project', rollupOptions: {input: path.resolve(import.meta.dirname, 'project.html')}}}
    : {}),
  test: {
    projects: [
      {
        extends: true,
        test: {
          name: 'unit',
          execArgv: ['--localstorage-file', path.resolve(os.tmpdir(), `vitest-${process.pid}.localstorage`)],
          environment: 'node',
          include: ['src/**/*.test.{ts,tsx}'],
          exclude: [...configDefaults.exclude, 'src/**/*.react.test.*'],
        },
      },
      {
        extends: true,
        test: {
          name: 'react',
          environment: 'jsdom',
          setupFiles: ['./src/testing/setupReactAct.ts'],
          include: ['src/**/*.react.test.{ts,tsx}'],
        },
      },
    ],
  },
}));
