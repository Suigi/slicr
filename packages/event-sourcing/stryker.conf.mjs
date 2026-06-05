export default {
  packageManager: 'npm',
  testRunner: 'vitest',
  vitest: {
    configFile: 'vitest.mutation.config.ts',
  },
  // coverageAnalysis: 'off',
  reporters: ['html', 'clear-text', 'progress'],
  // concurrency: 1,
  checkers: ['typescript'],
  tsconfigFile: 'tsconfig.json',
  mutate: [
    'src/**/*.ts',
    '!src/**/*.test.ts',
    '!src/**/*.browser.test.ts',
    '!src/_setup/**',
  ],
};
