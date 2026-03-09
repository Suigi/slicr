import { DiagramEdgeGeometry, middlePoint, routeElkEdges, routeForwardEdge, routePolyline } from './diagramRouting';
import { buildElkLaneMeta, computeElkLayout } from './elkLayout';
import { applyOverviewPostLayoutPasses } from './elkPostLayout';
import { layoutGraph, PAD_X } from './layoutGraph';
import { projectNodeHeights } from './nodeSizing';
import type { NodeDimensions } from './nodeSizing';
import type { ParsedSliceProjection } from './parsedSliceProjection';
import type { LayoutResult, Parsed, Position, VisualNode } from './types';

export type DiagramEngineId = 'elk';

export type DiagramEngineLayout = {
  layout: LayoutResult;
  laneByKey: Map<string, number>;
  rowStreamLabels: Record<number, string>;
  precomputedEdges?: Record<string, DiagramEdgeGeometry>;
};

export type OverviewNodeMetadata = {
  sourceSliceId: string;
  sourceSliceName: string;
  sourceNodeKey: string;
  sliceDslOrder: number;
};

export type OverviewDiagramGraph = {
  parsed: Parsed;
  nodeMetadataByKey: Map<string, OverviewNodeMetadata>;
};

const MIN_INTER_SLICE_GAP = 40 + PAD_X;
const MIN_LANE_GAP = 40;
const LEFT_LAYOUT_PADDING = 50;

export type RenderedDiagramEdge = {
  key: string;
  edgeKey: string;
  edge: Parsed['edges'][number];
  geometry: DiagramEdgeGeometry;
};

type DiagramLayoutOptions = {
  nodeDimensions?: Record<string, NodeDimensions>;
};

function toDiagramParsed(parsed: Parsed): Parsed {
  if (parsed.scenarioOnlyNodeKeys.length === 0) {
    return parsed;
  }
  const scenarioOnlyNodeKeys = new Set(parsed.scenarioOnlyNodeKeys);
  const nodes = new Map(
    [...parsed.nodes.entries()].filter(([key]) => !scenarioOnlyNodeKeys.has(key))
  );
  const edges = parsed.edges.filter(
    (edge) => nodes.has(edge.from) && nodes.has(edge.to)
  );
  const boundaries = parsed.boundaries.filter((boundary) => nodes.has(boundary.after));
  return {
    ...parsed,
    nodes,
    edges,
    boundaries,
    scenarioOnlyNodeKeys: []
  };
}

export function buildOverviewDiagramGraph(parsedSlices: ParsedSliceProjection<Parsed>[]): OverviewDiagramGraph {
  const nodes = new Map<string, VisualNode>();
  const edges: Parsed['edges'] = [];
  const boundaries: Parsed['boundaries'] = [];
  const warnings: Parsed['warnings'] = [];
  const scenarios: Parsed['scenarios'] = [];
  const scenarioOnlyNodeKeys: string[] = [];
  const nodeMetadataByKey = new Map<string, OverviewNodeMetadata>();

  const namespaceNodeKey = (sliceId: string, nodeKey: string) => `${sliceId}::${nodeKey}`;
  const namespaceScenarioEntry = (
    sliceId: string,
    entry: Parsed['scenarios'][number]['given'][number]
  ) => ({
    ...entry,
    key: namespaceNodeKey(sliceId, entry.key)
  });

  for (const slice of parsedSlices) {
    const diagramParsed = toDiagramParsed(slice.parsed);
    for (const [dslOrder, [key, node]] of [...diagramParsed.nodes.entries()].entries()) {
      const namespacedKey = namespaceNodeKey(slice.id, key);
      nodes.set(namespacedKey, {
        ...node,
        key: namespacedKey
      });
      nodeMetadataByKey.set(namespacedKey, {
        sourceSliceId: slice.id,
        sourceSliceName: slice.parsed.sliceName,
        sourceNodeKey: key,
        sliceDslOrder: dslOrder
      });
    }
    edges.push(
      ...diagramParsed.edges.map((edge) => ({
        ...edge,
        from: namespaceNodeKey(slice.id, edge.from),
        to: namespaceNodeKey(slice.id, edge.to)
      }))
    );
    boundaries.push(
      ...diagramParsed.boundaries.map((boundary) => ({
        ...boundary,
        after: namespaceNodeKey(slice.id, boundary.after)
      }))
    );
    warnings.push(...diagramParsed.warnings);
    scenarios.push(
      ...diagramParsed.scenarios.map((scenario) => ({
        ...scenario,
        given: scenario.given.map((entry) => namespaceScenarioEntry(slice.id, entry)),
        when: scenario.when ? namespaceScenarioEntry(slice.id, scenario.when) : null,
        then: scenario.then.map((entry) => namespaceScenarioEntry(slice.id, entry))
      }))
    );
    scenarioOnlyNodeKeys.push(
      ...diagramParsed.scenarioOnlyNodeKeys.map((nodeKey) => namespaceNodeKey(slice.id, nodeKey))
    );
  }

  return {
    parsed: {
      sliceName: 'Overview',
      nodes,
      edges,
      warnings,
      boundaries,
      scenarios,
      scenarioOnlyNodeKeys
    },
    nodeMetadataByKey
  };
}

function buildOverviewSliceOrderSpecs(
  parsedSlices: ParsedSliceProjection<Parsed>[],
  nodeMetadataByKey: Map<string, OverviewNodeMetadata>
) {
  return parsedSlices.map((slice) => ({
    sliceId: slice.id,
    nodeKeys: [...nodeMetadataByKey.entries()]
      .filter(([, metadata]) => metadata.sourceSliceId === slice.id)
      .sort((left, right) => left[1].sliceDslOrder - right[1].sliceDslOrder)
      .map(([key]) => key)
  }));
}

function buildLaneKeys(parsed: Parsed, laneByKey: Map<string, number>) {
  const laneKeys = new Map<number, string[]>();
  for (const node of parsed.nodes.values()) {
    const lane = laneByKey.get(node.key);
    if (lane === undefined) {
      continue;
    }
    const list = laneKeys.get(lane) ?? [];
    list.push(node.key);
    laneKeys.set(lane, list);
  }
  return laneKeys;
}

function measureLayoutBounds(
  pos: Record<string, Position>,
  precomputedEdges?: Record<string, DiagramEdgeGeometry>
): Pick<LayoutResult, 'w' | 'h'> {
  let maxX = 0;
  let maxY = 0;

  for (const node of Object.values(pos)) {
    maxX = Math.max(maxX, node.x + node.w);
    maxY = Math.max(maxY, node.y + node.h);
  }

  for (const geometry of Object.values(precomputedEdges ?? {})) {
    for (const point of geometry.points ?? []) {
      maxX = Math.max(maxX, point.x);
      maxY = Math.max(maxY, point.y);
    }
  }

  return {
    w: maxX + PAD_X,
    h: maxY + 48
  };
}

export async function computeDiagramLayout(
  parsed: Parsed,
  options: DiagramLayoutOptions = {}
): Promise<DiagramEngineLayout> {
  const diagramParsed = toDiagramParsed(parsed);
  const elk = await computeElkLayout(diagramParsed, options.nodeDimensions);
  return {
    layout: {
      pos: elk.pos,
      w: elk.w,
      h: elk.h,
      rowY: {},
      usedRows: [],
      rowStreamLabels: elk.rowStreamLabels
    },
    laneByKey: elk.laneByKey,
    rowStreamLabels: elk.rowStreamLabels,
    precomputedEdges: elk.edges
  };
}

export async function computeOverviewDiagramLayout(
  parsedSlices: ParsedSliceProjection<Parsed>[],
  options: DiagramLayoutOptions = {}
): Promise<DiagramEngineLayout> {
  const overviewGraph = buildOverviewDiagramGraph(parsedSlices);
  const mergedParsed = overviewGraph.parsed;
  if (mergedParsed.nodes.size === 0) {
    return {
      layout: {
        pos: {},
        w: 0,
        h: 0,
        rowY: {},
        usedRows: [],
        rowStreamLabels: {}
      },
      laneByKey: new Map(),
      rowStreamLabels: {}
    };
  }

  const elk = await computeElkLayout(mergedParsed, options.nodeDimensions);
  const sliceOrderSpecs = buildOverviewSliceOrderSpecs(parsedSlices, overviewGraph.nodeMetadataByKey);
  const laneKeys = buildLaneKeys(mergedParsed, elk.laneByKey);
  applyOverviewPostLayoutPasses({
    sliceSpecs: sliceOrderSpecs,
    laneKeys,
    nodesById: elk.pos,
    minInterSliceGap: MIN_INTER_SLICE_GAP,
    minLaneGap: MIN_LANE_GAP,
    leftLayoutPadding: LEFT_LAYOUT_PADDING
  });
  const precomputedEdges = routeElkEdges(
    mergedParsed.edges.map((edge, index) => ({
      key: `${edge.from}->${edge.to}#${index}`,
      from: edge.from,
      to: edge.to
    })),
    elk.pos
  );
  const { w, h } = measureLayoutBounds(elk.pos, precomputedEdges);

  return {
    layout: {
      pos: elk.pos,
      w,
      h,
      rowY: {},
      usedRows: [],
      rowStreamLabels: elk.rowStreamLabels
    },
    laneByKey: elk.laneByKey,
    rowStreamLabels: elk.rowStreamLabels,
    precomputedEdges
  };
}

export function computeProvisionalDiagramLayout(parsed: Parsed, options: DiagramLayoutOptions = {}): DiagramEngineLayout {
  const diagramParsed = toDiagramParsed(parsed);
  const provisional = layoutGraph(
    diagramParsed.nodes,
    diagramParsed.edges,
    diagramParsed.boundaries,
    projectNodeHeights(options.nodeDimensions)
  );

  return {
    layout: provisional,
    laneByKey: buildElkLaneMeta(diagramParsed).laneByKey,
    rowStreamLabels: buildElkLaneMeta(diagramParsed).rowStreamLabels
  };
}

export function routeDiagramEdge(
  from: Position,
  to: Position,
  options?: { sourceAttachmentCount?: number; targetAttachmentCount?: number; routeIndex?: number }
): DiagramEdgeGeometry {
  return routeForwardEdge(from, to, options);
}

export function supportsEditableEdgePoints(): boolean {
  return true;
}

export function buildRenderedEdges(
  parsed: Parsed,
  pos: Record<string, Position>,
  overrides?: Record<string, Array<{ x: number; y: number }>>
): RenderedDiagramEdge[] {
  const keyedEdges = parsed.edges.map((edge, index) => ({
    edge,
    index,
    edgeKey: `${edge.from}->${edge.to}#${index}`
  }));
  const attachmentCounts = new Map<string, number>();
  for (const edge of parsed.edges) {
    attachmentCounts.set(edge.from, (attachmentCounts.get(edge.from) ?? 0) + 1);
    attachmentCounts.set(edge.to, (attachmentCounts.get(edge.to) ?? 0) + 1);
  }
  const elkRouted = routeElkEdges(
    keyedEdges.map(({ edge, edgeKey }) => ({ key: edgeKey, from: edge.from, to: edge.to })),
    pos
  );

  return keyedEdges
    .map(({ edge, index, edgeKey }) => {
      const from = pos[edge.from];
      const to = pos[edge.to];
      if (!from || !to) {
        return null;
      }
      const base =
        elkRouted?.[edgeKey] ??
        routeDiagramEdge(from, to, {
          sourceAttachmentCount: attachmentCounts.get(edge.from) ?? 1,
          targetAttachmentCount: attachmentCounts.get(edge.to) ?? 1,
          routeIndex: index
        });
      const overridden = overrides?.[edgeKey];
      const geometry = overridden && overridden.length === base.points?.length
        ? {
          d: routePolyline(overridden),
          labelX: middlePoint(overridden).x,
          labelY: middlePoint(overridden).y - 7,
          points: overridden.map((point) => ({ ...point }))
        }
        : base;
      return { key: `${edge.from}-${edge.to}-${index}`, edgeKey, edge, geometry };
    })
    .filter((value): value is RenderedDiagramEdge => Boolean(value));
}
