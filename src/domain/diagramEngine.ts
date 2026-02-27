import { edgePath } from './edgePath';
import { DiagramEdgeGeometry, middlePoint, routeElkEdges, routeForwardEdge, routePolyline } from './diagramRouting';
import { buildElkLaneMeta, computeElkLayout } from './elkLayout';
import { layoutGraph } from './layoutGraph';
import { projectNodeHeights } from './nodeSizing';
import type { NodeDimensions } from './nodeSizing';
import type { LayoutResult, Parsed, Position } from './types';

export type DiagramEngineId = 'classic' | 'elk';

export type DiagramEngineLayout = {
  layout: LayoutResult;
  laneByKey: Map<string, number>;
  rowStreamLabels: Record<number, string>;
  precomputedEdges?: Record<string, DiagramEdgeGeometry>;
};

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

export async function computeDiagramLayout(
  parsed: Parsed,
  engine: DiagramEngineId,
  options: DiagramLayoutOptions = {}
): Promise<DiagramEngineLayout> {
  const diagramParsed = toDiagramParsed(parsed);
  if (engine === 'elk') {
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

  return computeClassicDiagramLayout(diagramParsed, options);
}

export function computeClassicDiagramLayout(parsed: Parsed, options: DiagramLayoutOptions = {}): DiagramEngineLayout {
  const diagramParsed = toDiagramParsed(parsed);
  const classic = layoutGraph(diagramParsed.nodes, diagramParsed.edges, diagramParsed.boundaries, projectNodeHeights(options.nodeDimensions));
  return {
    layout: classic,
    laneByKey: buildElkLaneMeta(diagramParsed).laneByKey,
    rowStreamLabels: classic.rowStreamLabels
  };
}

export function routeDiagramEdge(
  engine: DiagramEngineId,
  from: Position,
  to: Position,
  options?: { sourceAttachmentCount?: number; targetAttachmentCount?: number; routeIndex?: number }
): DiagramEdgeGeometry {
  if (engine === 'elk') {
    return routeForwardEdge(from, to, options);
  }
  const path = edgePath(from, to);
  return { d: path.d, labelX: path.labelX, labelY: path.labelY };
}

export function supportsEditableEdgePoints(engine: DiagramEngineId): boolean {
  return engine === 'elk';
}

export function buildRenderedEdges(
  parsed: Parsed,
  pos: Record<string, Position>,
  engine: DiagramEngineId,
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
  const elkRouted = engine === 'elk'
    ? routeElkEdges(
      keyedEdges.map(({ edge, edgeKey }) => ({ key: edgeKey, from: edge.from, to: edge.to })),
      pos
    )
    : null;

  return keyedEdges
    .map(({ edge, index, edgeKey }) => {
      const from = pos[edge.from];
      const to = pos[edge.to];
      if (!from || !to) {
        return null;
      }
      const base =
        elkRouted?.[edgeKey] ??
        routeDiagramEdge(engine, from, to, {
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
