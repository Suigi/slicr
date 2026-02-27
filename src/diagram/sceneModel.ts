import { DiagramEngineId, DiagramEngineLayout, RenderedDiagramEdge } from '../domain/diagramEngine';
import { routeRoundedPolyline } from '../domain/diagramRouting';
import { PAD_X, rowFor } from '../domain/layoutGraph';
import type { LayoutResult, Parsed, Position, VisualNode } from '../domain/types';
import type {
  DiagramBoundary,
  DiagramEdge,
  DiagramLane,
  DiagramNode,
  DiagramScenario,
  DiagramScenarioNode,
  DiagramSceneModel,
  DiagramTitle,
  DiagramViewport
} from './rendererContract';

const TYPE_LABEL: Record<string, string> = {
  rm: 'rm',
  cmd: 'cmd',
  evt: 'evt',
  exc: 'exc',
  ui: 'ui',
  generic: '',
  aut: 'aut',
  ext: 'ext'
};

const NODE_VERSION_SUFFIX = /@\d+$/;
const DEFAULT_CANVAS_MARGIN = 900;
const SCENARIO_AREA_TOP_GAP = 24;
const SCENARIO_BOX_HEIGHT = 176;
const SCENARIO_BOX_GAP = 16;
const SCENARIO_AREA_BOTTOM_PADDING = 24;

export type BuildSceneModelInput = {
  parsed: Parsed | null;
  activeLayout: LayoutResult | null;
  displayedPos: Record<string, Position>;
  renderedEdges: RenderedDiagramEdge[];
  routeMode: DiagramEngineId;
  engineLayout: DiagramEngineLayout | null;
  activeNodeKeyFromEditor: string | null;
  selectedNodeKey: string | null;
  hoveredEdgeKey: string | null;
  hoveredTraceNodeKey: string | null;
  canvasMargin?: number;
  laneLabelLeft?: number;
};

function computeCanvasViewport(
  activeLayout: LayoutResult,
  displayedPos: Record<string, Position>,
  renderedEdges: RenderedDiagramEdge[],
  canvasMargin: number,
  scenarioCount: number
): DiagramViewport {
  let minX = 0;
  let minY = 0;
  let maxX = activeLayout.w;
  let maxY = activeLayout.h;

  for (const position of Object.values(displayedPos)) {
    minX = Math.min(minX, position.x);
    minY = Math.min(minY, position.y);
    maxX = Math.max(maxX, position.x + position.w);
    maxY = Math.max(maxY, position.y + position.h);
  }

  for (const rendered of renderedEdges) {
    const points = rendered.geometry.points;
    if (!points) {
      continue;
    }
    for (const point of points) {
      minX = Math.min(minX, point.x);
      minY = Math.min(minY, point.y);
      maxX = Math.max(maxX, point.x);
      maxY = Math.max(maxY, point.y);
    }
  }

  if (scenarioCount > 0) {
    const scenariosHeight = (scenarioCount * SCENARIO_BOX_HEIGHT)
      + (Math.max(0, scenarioCount - 1) * SCENARIO_BOX_GAP)
      + SCENARIO_AREA_BOTTOM_PADDING;
    maxY = Math.max(maxY, activeLayout.h + SCENARIO_AREA_TOP_GAP + scenariosHeight);
  }

  const contentWidth = Math.max(1, maxX - minX);
  const contentHeight = Math.max(1, maxY - minY);
  return {
    width: contentWidth + canvasMargin * 2,
    height: contentHeight + canvasMargin * 2,
    offsetX: canvasMargin - minX,
    offsetY: canvasMargin - minY
  };
}

function buildLanes(
  parsed: Parsed,
  activeLayout: LayoutResult,
  routeMode: DiagramEngineId,
  engineLayout: DiagramEngineLayout | null,
  displayedPos: Record<string, Position>,
  visibleNodeKeys: Set<string>,
  labelLeft: number
): DiagramLane[] {
  if (routeMode === 'classic') {
    const rowsWithVisibleNodes = new Set<number>();
    for (const key of visibleNodeKeys) {
      const position = displayedPos[key];
      if (!position) {
        continue;
      }
      const row = activeLayout.usedRows.find((candidate) => activeLayout.rowY[candidate] === position.y);
      if (row !== undefined) {
        rowsWithVisibleNodes.add(row);
      }
    }
    const usedRows = activeLayout.usedRows.filter((row) => rowsWithVisibleNodes.has(row));

    return usedRows.map((row, index) => {
      const bandTop = activeLayout.rowY[row] - 28;
      const bandHeight =
        index < usedRows.length - 1
          ? activeLayout.rowY[usedRows[index + 1]] - activeLayout.rowY[row]
          : activeLayout.h - bandTop;
      const streamLabel = activeLayout.rowStreamLabels[row] ?? '';
      return {
        key: `lane-${row}`,
        row,
        bandTop,
        bandHeight,
        y: activeLayout.rowY[row],
        height: bandHeight,
        streamLabel,
        labelTop: bandTop + 8,
        labelLeft
      };
    });
  }

  const rowBuckets = new Map<number, { minY: number; streamLabel: string }>();
  const laneByKey = engineLayout?.laneByKey ?? new Map<string, number>();
  for (const node of parsed.nodes.values()) {
    const position = displayedPos[node.key];
    if (!position) {
      continue;
    }
    const row = laneByKey.get(node.key) ?? rowFor(node.type);
    const existing = rowBuckets.get(row);
    const streamLabel = engineLayout?.rowStreamLabels[row] ?? existing?.streamLabel ?? '';
    rowBuckets.set(row, {
      minY: existing ? Math.min(existing.minY, position.y) : position.y,
      streamLabel
    });
  }

  const usedRows = [...rowBuckets.keys()].sort((a, b) => a - b);
  const rowY: Record<number, number> = {};
  const rowStreamLabels: Record<number, string> = {};
  for (const row of usedRows) {
    const bucket = rowBuckets.get(row);
    if (!bucket) {
      continue;
    }
    rowY[row] = bucket.minY;
    if (bucket.streamLabel) {
      rowStreamLabels[row] = bucket.streamLabel;
    }
  }

  return usedRows.map((row, index) => {
    const bandTop = rowY[row] - 28;
    const bandHeight =
      index < usedRows.length - 1
        ? rowY[usedRows[index + 1]] - rowY[row]
        : activeLayout.h - bandTop;
    const streamLabel = rowStreamLabels[row] ?? '';
    return {
      key: `lane-${row}`,
      row,
      bandTop,
      bandHeight,
      y: rowY[row],
      height: bandHeight,
      streamLabel,
      labelTop: bandTop + 8,
      labelLeft
    };
  });
}

function buildBoundaries(parsed: Parsed, displayedPos: Record<string, Position>, lanes: DiagramLane[], worldHeight: number): DiagramBoundary[] {
  const topLaneY = lanes.length === 0 ? 0 : lanes[0].y;
  const dividerTop = (topLaneY - 28) - 40;

  return parsed.boundaries
    .map((boundary, index) => {
      const afterPos = displayedPos[boundary.after];
      if (!afterPos) {
        return null;
      }
      const x = afterPos.x + afterPos.w + 40;
      return {
        key: `slice-divider-${index}-${boundary.after}`,
        left: x,
        x,
        top: dividerTop,
        height: worldHeight - dividerTop
      };
    })
    .filter((boundary): boundary is DiagramBoundary => Boolean(boundary));
}

function toDisplayNode(node: VisualNode): VisualNode {
  return {
    ...node,
    name: node.name.replace(NODE_VERSION_SUFFIX, '')
  };
}

function buildDraggableSegmentIndices(pointsLength: number): number[] {
  if (pointsLength < 2) {
    return [];
  }
  const segmentCount = pointsLength - 1;
  const middleIndex = Math.max(0, Math.floor((segmentCount - 1) / 2));
  const indices = new Set<number>([0, middleIndex, segmentCount - 1]);
  return [...indices].sort((a, b) => a - b);
}

function toScenarioNode(entry: Parsed['scenarios'][number]['given'][number], parsed: Parsed): DiagramScenarioNode {
  const node = parsed.nodes.get(entry.key);
  const displayNode = node ? toDisplayNode(node) : null;
  const type = displayNode?.type ?? entry.type;
  const prefix = TYPE_LABEL[type] ?? type;
  const title = displayNode ? (displayNode.alias ?? displayNode.name) : (entry.alias ?? entry.name);
  const scenarioNode = displayNode ?? {
    type,
    name: entry.name,
    alias: entry.alias,
    stream: null,
    key: entry.key,
    data: null,
    srcRange: entry.srcRange
  };
  return {
    key: entry.key,
    node: scenarioNode,
    nodePrefix: prefix,
    type,
    title,
    prefix,
    srcRange: entry.srcRange
  };
}

function buildScenarios(parsed: Parsed): DiagramScenario[] {
  return parsed.scenarios.map((scenario) => ({
    name: scenario.name,
    srcRange: scenario.srcRange,
    given: scenario.given.map((entry) => toScenarioNode(entry, parsed)),
    when: scenario.when ? toScenarioNode(scenario.when, parsed) : null,
    then: scenario.then.map((entry) => toScenarioNode(entry, parsed))
  }));
}

export function buildSceneModel(input: BuildSceneModelInput): DiagramSceneModel | null {
  const {
    parsed,
    activeLayout,
    displayedPos,
    renderedEdges,
    routeMode,
    engineLayout,
    activeNodeKeyFromEditor,
    selectedNodeKey,
    hoveredEdgeKey,
    hoveredTraceNodeKey,
    canvasMargin = DEFAULT_CANVAS_MARGIN,
    laneLabelLeft = Math.max(8, PAD_X - 48)
  } = input;

  if (!parsed || !activeLayout) {
    return null;
  }

  const viewport = computeCanvasViewport(activeLayout, displayedPos, renderedEdges, canvasMargin, parsed.scenarios.length);
  const scenarioOnlyNodeKeys = new Set(parsed.scenarioOnlyNodeKeys);
  const visibleNodeKeys = new Set([...parsed.nodes.keys()].filter((key) => !scenarioOnlyNodeKeys.has(key)));
  const lanes = buildLanes(parsed, activeLayout, routeMode, engineLayout, displayedPos, visibleNodeKeys, laneLabelLeft);
  const visibleDisplayedPos: Record<string, Position> = {};
  for (const [key, position] of Object.entries(displayedPos)) {
    if (visibleNodeKeys.has(key)) {
      visibleDisplayedPos[key] = position;
    }
  }
  const boundaries = buildBoundaries(parsed, visibleDisplayedPos, lanes, activeLayout.h);
  const title: DiagramTitle | null = parsed.sliceName
    ? { text: parsed.sliceName, top: 6, left: PAD_X }
    : null;

  const hoveredEdge = hoveredEdgeKey
    ? renderedEdges.find(({ edgeKey }) => edgeKey === hoveredEdgeKey)
    : undefined;
  const hoveredEdgeNodeKeys = hoveredEdge ? new Set<string>([hoveredEdge.edge.from, hoveredEdge.edge.to]) : new Set<string>();
  const nodes: DiagramNode[] = [...parsed.nodes.values()]
    .filter((node) => !scenarioOnlyNodeKeys.has(node.key))
    .map((node) => {
      const position = displayedPos[node.key];
      if (!position) {
        return null;
      }
      const isHighlighted = activeNodeKeyFromEditor === node.key;
      const isSelected = selectedNodeKey === node.key;
      const isRelated = hoveredEdgeNodeKeys.has(node.key);
      const isTraceHovered = hoveredTraceNodeKey === node.key;
      const className = [
        isHighlighted ? 'highlighted' : '',
        isSelected ? 'selected' : '',
        isRelated ? 'related' : '',
        isTraceHovered ? 'trace-hovered' : ''
      ].filter(Boolean).join(' ');
      const displayNode = toDisplayNode(node);
      const nodePrefix = TYPE_LABEL[node.type] ?? node.type;
      return {
        renderKey: node.key,
        key: node.key,
        node: displayNode,
        nodePrefix,
        className,
        type: displayNode.type,
        title: displayNode.alias ?? displayNode.name,
        prefix: nodePrefix,
        x: position.x,
        y: position.y,
        w: position.w,
        h: position.h,
        srcRange: displayNode.srcRange,
        highlighted: isHighlighted,
        selected: isSelected,
        related: isRelated
      };
    })
    .filter((node): node is DiagramNode => Boolean(node));

  const edges: DiagramEdge[] = renderedEdges.map(({ key, edgeKey, edge, geometry }) => {
    const points = geometry.points ?? [];
    const path = geometry.points ? routeRoundedPolyline(geometry.points, 5) : geometry.d;
    const isHovered = hoveredEdgeKey === edgeKey;
    const isRelated = isHovered;
    return {
      renderKey: key,
      key: edgeKey,
      edgeKey,
      from: edge.from,
      to: edge.to,
      path,
      d: geometry.d,
      label: edge.label,
      points,
      draggableSegmentIndices: buildDraggableSegmentIndices(points.length),
      labelX: geometry.labelX,
      labelY: geometry.labelY,
      hovered: isHovered,
      related: isRelated
    };
  });

  return {
    nodes,
    edges,
    lanes,
    boundaries,
    scenarios: buildScenarios(parsed),
    worldWidth: activeLayout.w,
    worldHeight: activeLayout.h,
    title,
    viewport
  };
}
