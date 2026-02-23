import { describe, expect, it } from 'vitest';
import { collectDataIssues } from './dataIssues';
import { parseDsl } from './parseDsl';

describe('collectDataIssues', () => {
  it('reports missing source for uses keys', () => {
    const dsl = `slice "Issues"

cmd:buy "Buy"
uses:
  concertId
`;

    const parsed = parseDsl(dsl);
    const issues = collectDataIssues({ dsl, nodes: parsed.nodes, edges: parsed.edges });
    expect(issues).toEqual([
      expect.objectContaining({
        code: 'missing-source',
        nodeKey: 'buy',
        key: 'concertId'
      })
    ]);
  });
});
