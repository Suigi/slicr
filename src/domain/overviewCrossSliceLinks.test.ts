import { describe, expect, it } from 'vitest';
import { buildOverviewDiagramGraph } from './diagramEngine';
import type { ParsedSliceProjection } from './parsedSliceProjection';
import type { Parsed, VisualNode } from './types';
import { collectOverviewBoundaryNodes, toCrossSliceLogicalRef } from './overviewCrossSliceLinks';

function makeNode(key: string, name: string): VisualNode {
  return {
    type: 'cmd',
    name,
    alias: null,
    stream: null,
    key,
    data: null,
    srcRange: { from: 0, to: 0 }
  };
}

function makeProjection(id: string, parsed: Parsed): ParsedSliceProjection<Parsed> {
  return {
    id,
    dsl: `slice "${parsed.sliceName}"`,
    parsed
  };
}

describe('overviewCrossSliceLinks', () => {
  it('strips any trailing @... suffix when building an overview cross-slice logical ref', () => {
    expect(toCrossSliceLogicalRef('evt', 'order-created')).toBe('evt:order-created');
    expect(toCrossSliceLogicalRef('evt', 'order-created@1')).toBe('evt:order-created');
    expect(toCrossSliceLogicalRef('evt', 'order-created@1.2')).toBe('evt:order-created');
    expect(toCrossSliceLogicalRef('evt', 'order-created@vNext')).toBe('evt:order-created');
  });

  it('preserves embedded @ characters when stripping only the trailing suffix', () => {
    expect(toCrossSliceLogicalRef('evt', 'order@created@vNext')).toBe('evt:order@created');
  });

  it('excludes scenario-only nodes from overview boundary candidate detection', () => {
    const visibleNode = makeNode('cmd:visible', 'visible');
    const scenarioOnlyNode: VisualNode = {
      ...makeNode('evt:scenario-only', 'scenario-only'),
      type: 'evt'
    };
    const parsed: Parsed = {
      sliceName: 'Slice',
      nodes: new Map([
        [visibleNode.key, visibleNode],
        [scenarioOnlyNode.key, scenarioOnlyNode]
      ]),
      edges: [],
      warnings: [],
      boundaries: [],
      scenarios: [],
      scenarioOnlyNodeKeys: [scenarioOnlyNode.key]
    };
    const projection = makeProjection('slice-1', parsed);
    const overview = buildOverviewDiagramGraph([projection]);

    expect(collectOverviewBoundaryNodes([projection], overview.nodeMetadataByKey)).toEqual([
      {
        overviewNodeKey: 'slice-1::cmd:visible',
        sourceSliceId: 'slice-1',
        sourceSliceName: 'Slice',
        sourceNodeKey: 'cmd:visible',
        nodeType: 'cmd',
        nodeName: 'visible',
        logicalRef: 'cmd:visible',
        sliceIndex: 0,
        hasIncoming: false,
        hasOutgoing: false
      }
    ]);
  });

  it('evaluates boundary eligibility per concrete versioned node occurrence', () => {
    const startNode = makeNode('cmd:start', 'start');
    const firstVersion: VisualNode = {
      ...makeNode('evt:order-created@1', 'order-created@1'),
      type: 'evt'
    };
    const endNode = makeNode('cmd:end', 'end');
    const secondVersion: VisualNode = {
      ...makeNode('evt:order-created@2', 'order-created@2'),
      type: 'evt'
    };
    const parsed: Parsed = {
      sliceName: 'Slice',
      nodes: new Map([
        [startNode.key, startNode],
        [firstVersion.key, firstVersion],
        [endNode.key, endNode],
        [secondVersion.key, secondVersion]
      ]),
      edges: [
        { from: startNode.key, to: firstVersion.key, label: null },
        { from: firstVersion.key, to: endNode.key, label: null }
      ],
      warnings: [],
      boundaries: [],
      scenarios: [],
      scenarioOnlyNodeKeys: []
    };
    const projection = makeProjection('slice-1', parsed);
    const overview = buildOverviewDiagramGraph([projection]);

    const orderCreatedCandidates = collectOverviewBoundaryNodes([projection], overview.nodeMetadataByKey)
      .filter((candidate) => candidate.logicalRef === 'evt:order-created');

    expect(orderCreatedCandidates).toEqual([
      {
        overviewNodeKey: 'slice-1::evt:order-created@2',
        sourceSliceId: 'slice-1',
        sourceSliceName: 'Slice',
        sourceNodeKey: 'evt:order-created@2',
        nodeType: 'evt',
        nodeName: 'order-created@2',
        logicalRef: 'evt:order-created',
        sliceIndex: 0,
        hasIncoming: false,
        hasOutgoing: false
      }
    ]);
  });
});
