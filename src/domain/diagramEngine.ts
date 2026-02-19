import { edgePath } from './edgePath';
import { DiagramEdgeGeometry, routeForwardEdge } from './diagramRouting';
import { buildElkLaneMeta, computeElkLayout } from './elkLayout';
import { layoutGraph } from './layoutGraph';
import type { LayoutResult, Parsed, Position } from './types';

export type DiagramEngineId = 'classic' | 'elk';

export type DiagramEngineLayout = {
  layout: LayoutResult;
  laneByKey: Map<string, number>;
  rowStreamLabels: Record<number, string>;
  precomputedEdges?: Record<string, DiagramEdgeGeometry>;
};

export async function computeDiagramLayout(parsed: Parsed, engine: DiagramEngineId): Promise<DiagramEngineLayout> {
  if (engine === 'elk') {
    const elk = await computeElkLayout(parsed);
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

  return computeClassicDiagramLayout(parsed);
}

export function computeClassicDiagramLayout(parsed: Parsed): DiagramEngineLayout {
  const classic = layoutGraph(parsed.nodes, parsed.edges, parsed.boundaries);
  return {
    layout: classic,
    laneByKey: buildElkLaneMeta(parsed).laneByKey,
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
