import { describe, expect, it } from 'vitest';
import { shouldShowDevDiagramControls } from './runtimeFlags';

describe('runtimeFlags', () => {
  it('shows dev diagram controls on localhost', () => {
    expect(shouldShowDevDiagramControls('localhost')).toBe(true);
  });

  it('hides dev diagram controls on non-localhost hosts', () => {
    expect(shouldShowDevDiagramControls('example.com')).toBe(false);
    expect(shouldShowDevDiagramControls('127.0.0.1')).toBe(false);
  });
});
