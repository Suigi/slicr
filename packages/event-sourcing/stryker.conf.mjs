export default {
  packageManager: 'npm',
  // The native Stryker Vitest runner currently crashes in this repo on Node 24;
  // use Stryker's command runner to execute the package's Vitest suite reliably.
  testRunner: 'command',
  commandRunner: {
    command: 'npm run test:mutation:vitest',
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
