var __spreadArray = (this && this.__spreadArray) || function (to, from, pack) {
    if (pack || arguments.length === 2) for (var i = 0, l = from.length, ar; i < l; i++) {
        if (ar || !(i in from)) {
            if (!ar) ar = Array.prototype.slice.call(from, 0, i);
            ar[i] = from[i];
        }
    }
    return to.concat(ar || Array.prototype.slice.call(from));
};
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
                    exclude: __spreadArray(__spreadArray([], configDefaults.exclude, true), ['src/**/*.interaction.browser.test.tsx'], false),
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
