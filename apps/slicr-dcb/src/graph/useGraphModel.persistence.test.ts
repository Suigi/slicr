import {readFileSync} from 'node:fs';
import {fileURLToPath} from 'node:url';
import {dirname, join} from 'node:path';
import {describe, expect, it} from 'vitest';

const currentDir = dirname(fileURLToPath(import.meta.url));

describe('useGraphModel event-sourced persistence', () => {
  it('does not write normal graph mutations to the legacy snapshot storage key', () => {
    const source = readFileSync(join(currentDir, 'useGraphModel.ts'), 'utf8');

    expect(source).not.toContain('slicr-dcb.graphModel.v1');
    expect(source).not.toContain('localStorage.setItem(STORAGE_KEY');
  });
});
