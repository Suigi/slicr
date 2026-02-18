import { describe, expect, it } from 'vitest';
import { getRelatedElements } from './traversal';
import { Parsed, VisualNode, Edge } from './types';

describe('traversal', () => {
  const nodes = new Map<string, VisualNode>();
  const createNode = (key: string) => ({
    key,
    type: 'rm',
    name: key,
    alias: null,
    stream: null,
    data: null,
    srcRange: { from: 0, to: 0 }
  } as VisualNode);

  nodes.set('A', createNode('A'));
  nodes.set('B', createNode('B'));
  nodes.set('C', createNode('C'));
  nodes.set('D', createNode('D'));
  nodes.set('E', createNode('E'));

  const edges: Edge[] = [
    { from: 'A', to: 'B', label: null },
    { from: 'B', to: 'C', label: null },
    { from: 'D', to: 'B', label: null },
    { from: 'C', to: 'E', label: null },
  ];

  const parsed: Parsed = {
    sliceName: 'Test',
    nodes,
    edges,
    warnings: [],
    boundaries: []
  };

  it('finds related nodes and edges for a middle node', () => {
    const result = getRelatedElements(parsed, 'B');
    
    // Nodes: B (self), A (parent), D (parent), C (child), E (grandchild)
    expect(result.nodes.has('A')).toBe(true);
    expect(result.nodes.has('B')).toBe(true);
    expect(result.nodes.has('C')).toBe(true);
    expect(result.nodes.has('D')).toBe(true);
    expect(result.nodes.has('E')).toBe(true);
    expect(result.nodes.size).toBe(5);

    // Edges connecting these nodes
    expect(result.edges.has('A->B')).toBe(true);
    expect(result.edges.has('B->C')).toBe(true);
    expect(result.edges.has('D->B')).toBe(true);
    expect(result.edges.has('C->E')).toBe(true);
    expect(result.edges.size).toBe(4);
  });

  it('finds related nodes and edges for a leaf node', () => {
    const result = getRelatedElements(parsed, 'E');
    
    // Nodes: E, C, B, A, D (all are ancestors)
    expect(result.nodes.has('E')).toBe(true);
    expect(result.nodes.has('C')).toBe(true);
    expect(result.nodes.has('B')).toBe(true);
    expect(result.nodes.has('A')).toBe(true);
    expect(result.nodes.has('D')).toBe(true);
    
    expect(result.edges.has('C->E')).toBe(true);
    expect(result.edges.has('B->C')).toBe(true);
  });

  it('returns empty for null selection', () => {
    const result = getRelatedElements(parsed, null);
    expect(result.nodes.size).toBe(0);
    expect(result.edges.size).toBe(0);
  });
});
