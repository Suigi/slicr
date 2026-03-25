import { describe, expect, it } from 'vitest';
import { buildOverviewDiagramGraph } from './diagramEngine';
import type { ParsedSliceProjection } from './parsedSliceProjection';
import type { Parsed, VisualNode } from './types';
import {
  collectOverviewBoundaryNodes,
  deriveOverviewCrossSliceLinks,
  toCrossSliceLogicalRef
} from './overviewCrossSliceLinks';

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

  it('links every eligible end occurrence to every eligible start occurrence in later slices with the same logical ref', () => {
    const alphaSource: VisualNode = { ...makeNode('evt:order-created@1', 'order-created@1'), type: 'evt' };
    const betaTargetOne: VisualNode = { ...makeNode('evt:order-created@2', 'order-created@2'), type: 'evt' };
    const gammaTarget: VisualNode = { ...makeNode('evt:order-created@3', 'order-created@3'), type: 'evt' };
    const gammaTargetTwo: VisualNode = { ...makeNode('evt:order-created@4', 'order-created@4'), type: 'evt' };
    const betaFollower = makeNode('cmd:beta-follower', 'beta-follower');
    const gammaLeader = makeNode('cmd:gamma-leader', 'gamma-leader');

    const projections = [
      makeProjection('slice-1', {
        sliceName: 'Alpha',
        nodes: new Map([[alphaSource.key, alphaSource]]),
        edges: [],
        warnings: [],
        boundaries: [],
        scenarios: [],
        scenarioOnlyNodeKeys: []
      }),
      makeProjection('slice-2', {
        sliceName: 'Beta',
        nodes: new Map([
          [betaTargetOne.key, betaTargetOne],
          [betaFollower.key, betaFollower]
        ]),
        edges: [{ from: betaTargetOne.key, to: betaFollower.key, label: null }],
        warnings: [],
        boundaries: [],
        scenarios: [],
        scenarioOnlyNodeKeys: []
      }),
      makeProjection('slice-3', {
        sliceName: 'Gamma',
        nodes: new Map([
          [gammaLeader.key, gammaLeader],
          [gammaTarget.key, gammaTarget],
          [gammaTargetTwo.key, gammaTargetTwo]
        ]),
        edges: [{ from: gammaLeader.key, to: gammaTarget.key, label: null }],
        warnings: [],
        boundaries: [],
        scenarios: [],
        scenarioOnlyNodeKeys: []
      })
    ];
    const overview = buildOverviewDiagramGraph(projections);

    const links = deriveOverviewCrossSliceLinks(projections, overview.nodeMetadataByKey);

    expect(links.map((link) => ({
      logicalRef: link.logicalRef,
      fromOverviewNodeKey: link.fromOverviewNodeKey,
      toOverviewNodeKey: link.toOverviewNodeKey,
      fromSliceId: link.fromSliceId,
      toSliceId: link.toSliceId
    }))).toEqual([
      {
        logicalRef: 'evt:order-created',
        fromOverviewNodeKey: 'slice-1::evt:order-created@1',
        toOverviewNodeKey: 'slice-2::evt:order-created@2',
        fromSliceId: 'slice-1',
        toSliceId: 'slice-2'
      },
      {
        logicalRef: 'evt:order-created',
        fromOverviewNodeKey: 'slice-1::evt:order-created@1',
        toOverviewNodeKey: 'slice-3::evt:order-created@4',
        fromSliceId: 'slice-1',
        toSliceId: 'slice-3'
      }
    ]);
  });

  it('excludes same-slice matches while still emitting every later-slice match for the same logical ref', () => {
    const alphaLeader = makeNode('cmd:alpha-leader', 'alpha-leader');
    const alphaFollower = makeNode('cmd:alpha-follower', 'alpha-follower');
    const alphaSource: VisualNode = { ...makeNode('evt:order-created@1', 'order-created@1'), type: 'evt' };
    const alphaSameSliceTarget: VisualNode = { ...makeNode('evt:order-created@2', 'order-created@2'), type: 'evt' };
    const betaTargetOne: VisualNode = { ...makeNode('evt:order-created@3', 'order-created@3'), type: 'evt' };
    const betaTargetTwo: VisualNode = { ...makeNode('evt:order-created@4', 'order-created@4'), type: 'evt' };
    const betaFollowerOne = makeNode('cmd:beta-follower-1', 'beta-follower-1');
    const betaFollowerTwo = makeNode('cmd:beta-follower-2', 'beta-follower-2');

    const projections = [
      makeProjection('slice-1', {
        sliceName: 'Alpha',
        nodes: new Map([
          [alphaLeader.key, alphaLeader],
          [alphaFollower.key, alphaFollower],
          [alphaSource.key, alphaSource],
          [alphaSameSliceTarget.key, alphaSameSliceTarget]
        ]),
        edges: [
          { from: alphaLeader.key, to: alphaSource.key, label: null },
          { from: alphaSameSliceTarget.key, to: alphaFollower.key, label: null }
        ],
        warnings: [],
        boundaries: [],
        scenarios: [],
        scenarioOnlyNodeKeys: []
      }),
      makeProjection('slice-2', {
        sliceName: 'Beta',
        nodes: new Map([
          [betaTargetOne.key, betaTargetOne],
          [betaTargetTwo.key, betaTargetTwo],
          [betaFollowerOne.key, betaFollowerOne],
          [betaFollowerTwo.key, betaFollowerTwo]
        ]),
        edges: [
          { from: betaTargetOne.key, to: betaFollowerOne.key, label: null },
          { from: betaTargetTwo.key, to: betaFollowerTwo.key, label: null }
        ],
        warnings: [],
        boundaries: [],
        scenarios: [],
        scenarioOnlyNodeKeys: []
      })
    ];
    const overview = buildOverviewDiagramGraph(projections);

    const links = deriveOverviewCrossSliceLinks(projections, overview.nodeMetadataByKey);

    expect(links.map((link) => ({
      fromOverviewNodeKey: link.fromOverviewNodeKey,
      toOverviewNodeKey: link.toOverviewNodeKey,
      fromSliceId: link.fromSliceId,
      toSliceId: link.toSliceId
    }))).toEqual([
      {
        fromOverviewNodeKey: 'slice-1::evt:order-created@1',
        toOverviewNodeKey: 'slice-2::evt:order-created@3',
        fromSliceId: 'slice-1',
        toSliceId: 'slice-2'
      },
      {
        fromOverviewNodeKey: 'slice-1::evt:order-created@1',
        toOverviewNodeKey: 'slice-2::evt:order-created@4',
        fromSliceId: 'slice-1',
        toSliceId: 'slice-2'
      }
    ]);
  });

  it('uses endpoint-pair keys so distinct source-target pairs remain distinct deterministically', () => {
    const sourceOne: VisualNode = { ...makeNode('evt:order-created@1', 'order-created@1'), type: 'evt' };
    const sourceTwo: VisualNode = { ...makeNode('evt:order-created@2', 'order-created@2'), type: 'evt' };
    const target: VisualNode = { ...makeNode('evt:order-created@3', 'order-created@3'), type: 'evt' };

    const projections = [
      makeProjection('slice-1', {
        sliceName: 'Alpha',
        nodes: new Map([
          [sourceOne.key, sourceOne],
          [sourceTwo.key, sourceTwo]
        ]),
        edges: [],
        warnings: [],
        boundaries: [],
        scenarios: [],
        scenarioOnlyNodeKeys: []
      }),
      makeProjection('slice-2', {
        sliceName: 'Beta',
        nodes: new Map([[target.key, target]]),
        edges: [],
        warnings: [],
        boundaries: [],
        scenarios: [],
        scenarioOnlyNodeKeys: []
      })
    ];
    const overview = buildOverviewDiagramGraph(projections);

    const links = deriveOverviewCrossSliceLinks(projections, overview.nodeMetadataByKey);

    expect(links.map((link) => link.key)).toEqual([
      'slice-1::evt:order-created@1->slice-2::evt:order-created@3',
      'slice-1::evt:order-created@2->slice-2::evt:order-created@3'
    ]);
  });
});
