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

  it('reports ambiguous source collisions for uses keys', () => {
    const dsl = `slice "Ambiguous"

evt:one "One"
data:
  alpha: "one"

evt:two "Two"
data:
  alpha: "two"

cmd:consume "Consume"
<- evt:one
<- evt:two
uses:
  alpha
`;

    const parsed = parseDsl(dsl);
    const issues = collectDataIssues({ dsl, nodes: parsed.nodes, edges: parsed.edges });
    expect(issues).toEqual([
      expect.objectContaining({
        code: 'ambiguous-source',
        nodeKey: 'consume',
        key: 'alpha'
      })
    ]);
  });

  it('includes severity and node/slice references in issues', () => {
    const dsl = `slice "Refs"

cmd:buy "Buy"
uses:
  concertId
`;

    const parsed = parseDsl(dsl);
    const issues = collectDataIssues({ dsl, nodes: parsed.nodes, edges: parsed.edges, sliceId: 'slice-a' });
    expect(issues[0]).toEqual(expect.objectContaining({
      severity: 'warning',
      nodeKey: 'buy',
      nodeRef: 'cmd:buy',
      sliceId: 'slice-a'
    }));
  });

  it('applies source overrides to resolve ambiguous-source issues', () => {
    const dsl = `slice "Ambiguous"

evt:one "One"
data:
  alpha: "one"

evt:two "Two"
data:
  alpha: "two"

cmd:consume "Consume"
<- evt:one
<- evt:two
uses:
  alpha
`;

    const parsed = parseDsl(dsl);
    const issues = collectDataIssues({
      dsl,
      nodes: parsed.nodes,
      edges: parsed.edges,
      sourceOverrides: { 'consume:alpha': 'one' }
    });
    expect(issues.some((issue) => issue.code === 'ambiguous-source')).toBe(false);
  });
});
