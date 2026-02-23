import { describe, expect, it } from 'vitest';
import { traceData } from './dataTrace';
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

describe('traceData', () => {
  it('returns null for generic nodes', () => {
    const nodes = new Map<string, VisualNode>([['generic-node', makeNode('generic')]]);

    expect(traceData({ nodes }, 'generic-node', 'alpha')).toBeNull();
  });
});
