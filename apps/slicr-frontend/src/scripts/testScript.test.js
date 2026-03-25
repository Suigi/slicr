// @vitest-environment node

import { afterEach, describe, expect, test } from 'vitest';
import { chmodSync, mkdtempSync, readFileSync, rmSync, mkdirSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';

const testFilePath = fileURLToPath(import.meta.url);
const repoRoot = path.resolve(path.dirname(testFilePath), '../..');
const scriptPath = path.join(repoRoot, 'scripts/test.sh');

function makeExecutable(filePath, contents) {
  mkdirSync(path.dirname(filePath), { recursive: true });
  writeFileSync(filePath, contents);
  chmodSync(filePath, 0o755);
}

function readFile(filePath) {
  return readFileSync(filePath, 'utf8');
}

describe('scripts/test.sh', () => {
  const tempDirs = [];

  afterEach(() => {
    for (const dir of tempDirs.splice(0)) {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  test('uses local npx to run the full vitest suite with the llm reporter when no filters are provided', () => {
    const tempDir = mkdtempSync(path.join(tmpdir(), 'test-script-'));
    const binDir = path.join(tempDir, 'bin');
    const logPath = path.join(tempDir, 'calls.log');
    tempDirs.push(tempDir);

    writeFileSync(logPath, '');
    makeExecutable(
      path.join(binDir, 'npx'),
      `#!/bin/sh
mkdir -p "${binDir}"
printf '%s\n' "$*" >> "${logPath}"
`,
    );

    const result = spawnSync('/bin/sh', [scriptPath], {
      cwd: repoRoot,
      env: {
        ...process.env,
        PATH: `${binDir}:${process.env.PATH ?? ''}`,
      },
      encoding: 'utf8',
    });

    expect(result.status).toBe(0);
    expect(result.stderr).toBe('');
    expect(result.stdout).toBe('');
    expect(readFile(logPath)).toBe('vitest run --reporter vitest-llm-reporter\n');
  });

  test('falls back to nix-shell and preserves explicit test filters when npx is unavailable', () => {
    const tempDir = mkdtempSync(path.join(tmpdir(), 'test-script-'));
    const binDir = path.join(tempDir, 'bin');
    const logPath = path.join(tempDir, 'calls.log');
    tempDirs.push(tempDir);

    writeFileSync(logPath, '');
    makeExecutable(
      path.join(binDir, 'nix-shell'),
      `#!/bin/sh
printf '%s\n' "$*" >> "${logPath}"
`,
    );

    const result = spawnSync('/bin/sh', [scriptPath, 'src/foo bar.test.ts', 'src/bar.test.ts'], {
      cwd: repoRoot,
      env: {
        ...process.env,
        PATH: binDir,
      },
      encoding: 'utf8',
    });

    expect(result.status).toBe(0);
    expect(result.stderr).toBe('');
    expect(result.stdout).toBe('');
    expect(readFile(logPath)).toBe(
      "--run npx vitest run --reporter vitest-llm-reporter 'src/foo bar.test.ts' 'src/bar.test.ts'\n",
    );
  });
});
