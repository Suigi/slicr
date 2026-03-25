import { describe, expect, it } from 'vitest';
import { isTraceableNode } from './nodeTracing';
import { VisualNode } from './types';

function makeNode(type: string): VisualNode {
  return {
    key: `${type}:node`,
    type,
    name: 'node',
    alias: null,
    stream: null,
    data: null,
    srcRange: { from: 0, to: 1 }
  };
}

describe('isTraceableNode', () => {
  it('returns false for generic nodes', () => {
    expect(isTraceableNode(makeNode('generic'))).toBe(false);
  });

  it('returns true for non-generic nodes', () => {
    expect(isTraceableNode(makeNode('cmd'))).toBe(true);
  });
});
