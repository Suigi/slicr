import { edgePath } from '../domain/edgePath';
import { computeElkLayout } from '../domain/elkLayout';
import { layoutGraph } from '../domain/layoutGraph';
import { parseDsl } from '../domain/parseDsl';
import type { Edge, LayoutResult, Parsed, Position } from '../domain/types';

export type DiagramNodeRect = {
  key: string;
  x: number;
  y: number;
  w: number;
  h: number;
};

export type DiagramEdgeRoute = {
  key: string;
  from: string;
  to: string;
  d: string;
};

export type DiagramGeometry = {
  parsed: Parsed;
  layout: LayoutResult;
  nodes: DiagramNodeRect[];
  edges: DiagramEdgeRoute[];
};

export type NodeExpectation = {
  key: string;
  x?: number;
  y?: number;
  w?: number;
  h?: number;
};

export type EdgeExpectation = {
  key?: string;
  from?: string;
  to?: string;
  d?: string;
};

export type DiagramExpectation = {
  nodes?: NodeExpectation[];
  edges?: EdgeExpectation[];
};

export type DiagramMatchOptions = {
  offset?: { x?: number; y?: number };
  nodeTolerance?: number;
  edgeTolerance?: number;
  edgePathMode?: 'exact' | 'endpoints';
};

export type GeometryHarnessOptions = {
  engine?: 'classic' | 'elk';
  layoutFn?: (parsed: Parsed) => LayoutResult;
  edgeRouteFn?: (from: Position, to: Position, edge: Edge, index: number) => { d: string };
};

export async function computeDiagramGeometry(dsl: string, options: GeometryHarnessOptions = {}): Promise<DiagramGeometry> {
  const parsed = parseDsl(dsl);
  const engine = options.engine ?? 'elk';
  const elk = engine === 'elk' ? await computeElkLayout(parsed) : null;
  const layout = elk
    ? ({ pos: elk.pos, w: elk.w, h: elk.h, rowY: {}, usedRows: [], rowStreamLabels: {} } as LayoutResult)
    : options.layoutFn
      ? options.layoutFn(parsed)
      : layoutGraph(parsed.nodes, parsed.edges, parsed.boundaries);
  const edgeRouteFn = options.edgeRouteFn ?? ((from: Position, to: Position) => edgePath(from, to));

  const nodes: DiagramNodeRect[] = [...parsed.nodes.values()]
    .map((node) => {
      const position = layout.pos[node.key];
      if (!position) {
        throw new Error(`Missing layout position for node "${node.key}"`);
      }
      return { key: node.key, x: position.x, y: position.y, w: position.w, h: position.h };
    })
    .sort((a, b) => a.key.localeCompare(b.key));

  const edges: DiagramEdgeRoute[] = parsed.edges
    .map((edge, index) => {
      const from = layout.pos[edge.from];
      const to = layout.pos[edge.to];
      if (!from || !to) {
        throw new Error(`Missing layout position for edge "${edge.from}->${edge.to}"`);
      }
      const elkRoute = elk?.edges[`${edge.from}->${edge.to}#${index}`];
      const route = elkRoute ?? edgeRouteFn(from, to, edge, index);
      return {
        key: `${edge.from}->${edge.to}#${index}`,
        from: edge.from,
        to: edge.to,
        d: route.d
      };
    })
    .sort((a, b) => a.key.localeCompare(b.key));

  return { parsed, layout, nodes, edges };
}

function applyOffsetToPath(path: string, offsetX: number, offsetY: number) {
  const parts = path.match(/[A-Za-z]|-?\d+(?:\.\d+)?/g);
  if (!parts) {
    return path;
  }
  let isX = true;
  const shifted = parts.map((part) => {
    if (/^[A-Za-z]$/.test(part)) {
      isX = true;
      return part;
    }
    const number = Number(part);
    if (!Number.isFinite(number)) {
      return part;
    }
    const value = number + (isX ? offsetX : offsetY);
    isX = !isX;
    return String(value);
  });
  return shifted.join(' ');
}

export function matchDiagramGeometry(actual: DiagramGeometry, expected: DiagramExpectation, options: DiagramMatchOptions = {}): string[] {
  const failures: string[] = [];
  const offsetX = options.offset?.x ?? 0;
  const offsetY = options.offset?.y ?? 0;
  const nodeTolerance = options.nodeTolerance ?? 0;
  const edgeTolerance = options.edgeTolerance ?? 0;
  const edgePathMode = options.edgePathMode ?? 'exact';

  const withinTolerance = (left: number, right: number, tolerance: number) => Math.abs(left - right) <= tolerance;
  const extractPoints = (path: string) => {
    const numbers = path.match(/-?\d+(?:\.\d+)?/g)?.map(Number) ?? [];
    const points: Array<{ x: number; y: number }> = [];
    for (let i = 0; i + 1 < numbers.length; i += 2) {
      points.push({ x: numbers[i], y: numbers[i + 1] });
    }
    return points;
  };
  const pointsSummary = (points: Array<{ x: number; y: number }>) =>
    points.map((point) => `(${point.x},${point.y})`).join(' -> ');

  for (const nodeExpected of expected.nodes ?? []) {
    const actualNode = actual.nodes.find((node) => node.key === nodeExpected.key);
    if (!actualNode) {
      failures.push(`Missing node "${nodeExpected.key}"`);
      continue;
    }
    const nodeX = actualNode.x + offsetX;
    const nodeY = actualNode.y + offsetY;
    if (nodeExpected.x !== undefined && !withinTolerance(nodeX, nodeExpected.x, nodeTolerance)) {
      failures.push(`Node "${nodeExpected.key}" x: expected ${nodeExpected.x}, got ${nodeX}`);
    }
    if (nodeExpected.y !== undefined && !withinTolerance(nodeY, nodeExpected.y, nodeTolerance)) {
      failures.push(`Node "${nodeExpected.key}" y: expected ${nodeExpected.y}, got ${nodeY}`);
    }
    if (nodeExpected.w !== undefined && actualNode.w !== nodeExpected.w) {
      failures.push(`Node "${nodeExpected.key}" w: expected ${nodeExpected.w}, got ${actualNode.w}`);
    }
    if (nodeExpected.h !== undefined && actualNode.h !== nodeExpected.h) {
      failures.push(`Node "${nodeExpected.key}" h: expected ${nodeExpected.h}, got ${actualNode.h}`);
    }
  }

  for (const edgeExpected of expected.edges ?? []) {
    const actualEdge = actual.edges.find((edge) => {
      if (edgeExpected.key && edge.key !== edgeExpected.key) {
        return false;
      }
      if (edgeExpected.from && edge.from !== edgeExpected.from) {
        return false;
      }
      if (edgeExpected.to && edge.to !== edgeExpected.to) {
        return false;
      }
      return true;
    });

    const expectedLabel = edgeExpected.key ?? `${edgeExpected.from ?? '*'}->${edgeExpected.to ?? '*'}`;
    if (!actualEdge) {
      failures.push(`Missing edge "${expectedLabel}"`);
      continue;
    }

    const actualPath = applyOffsetToPath(actualEdge.d, offsetX, offsetY);
    if (edgeExpected.d !== undefined) {
      const expectedPoints = extractPoints(edgeExpected.d);
      const actualPoints = extractPoints(actualPath);
      if (edgePathMode === 'exact') {
        if (actualPath !== edgeExpected.d) {
          let detail = '';
          const maxLen = Math.max(expectedPoints.length, actualPoints.length);
          for (let i = 0; i < maxLen; i += 1) {
            const expectedPoint = expectedPoints[i];
            const actualPoint = actualPoints[i];
            if (!expectedPoint || !actualPoint || expectedPoint.x !== actualPoint.x || expectedPoint.y !== actualPoint.y) {
              detail = ` first diff at point ${i}: expected ${expectedPoint ? `(${expectedPoint.x},${expectedPoint.y})` : 'none'}, got ${actualPoint ? `(${actualPoint.x},${actualPoint.y})` : 'none'}`;
              break;
            }
          }
          failures.push(
            `Edge "${actualEdge.key}" path mismatch.${detail} expected points: [${pointsSummary(expectedPoints)}], actual points: [${pointsSummary(actualPoints)}]`
          );
        }
      } else {
        const actualStart = actualPoints[0];
        const actualEnd = actualPoints[actualPoints.length - 1];
        const expectedStart = expectedPoints[0];
        const expectedEnd = expectedPoints[expectedPoints.length - 1];
        if (!actualStart || !actualEnd || !expectedStart || !expectedEnd) {
          failures.push(
            `Edge "${actualEdge.key}" path mismatch. expected points: [${pointsSummary(expectedPoints)}], actual points: [${pointsSummary(actualPoints)}]`
          );
        } else {
          const startMatches =
            withinTolerance(actualStart.x, expectedStart.x, edgeTolerance) &&
            withinTolerance(actualStart.y, expectedStart.y, edgeTolerance);
          const endMatches =
            withinTolerance(actualEnd.x, expectedEnd.x, edgeTolerance) &&
            withinTolerance(actualEnd.y, expectedEnd.y, edgeTolerance);
          if (!startMatches || !endMatches) {
            failures.push(
              `Edge "${actualEdge.key}" path mismatch. expected start/end: (${expectedStart.x},${expectedStart.y}) -> (${expectedEnd.x},${expectedEnd.y}), actual start/end: (${actualStart.x},${actualStart.y}) -> (${actualEnd.x},${actualEnd.y}). expected points: [${pointsSummary(expectedPoints)}], actual points: [${pointsSummary(actualPoints)}]`
            );
          }
        }
      }
    }
  }

  return failures;
}
