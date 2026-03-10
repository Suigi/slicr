import {
  DiagramEngineLayout,
  OverviewNodeMetadata,
  OverviewScenarioMetadata,
  RenderedDiagramEdge
} from '../domain/diagramEngine';
import type { OverviewCrossSliceLink } from '../domain/overviewCrossSliceLinks';
import type {LayoutResult, Parsed, ParsedScenario, Position, VisualNode} from '../domain/types';
import {routeRoundedPolyline} from '../domain/diagramRouting';
import {PAD_X, rowFor} from '../domain/layoutGraph';
import type {
  DiagramBoundary,
  DiagramEdge,
  DiagramLane,
  DiagramNode,
  DiagramScenario,
  DiagramScenarioGroup,
  DiagramScenarioNode,
  DiagramSceneModel,
  DiagramSliceFrame,
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
const OVERVIEW_SLICE_FRAME_PADDING_X = 28;
const OVERVIEW_SLICE_FRAME_PADDING_TOP = 22;
const OVERVIEW_SLICE_FRAME_PADDING_BOTTOM = 24;
const OVERVIEW_SLICE_FRAME_LABEL_GAP = 14;
const OVERVIEW_SLICE_FRAME_LABEL_HEIGHT = 14;

export type BuildSceneModelInput = {
  parsed: Parsed | null;
  activeLayout: LayoutResult | null;
  displayedPos: Record<string, Position>;
  renderedEdges: RenderedDiagramEdge[];
  engineLayout: DiagramEngineLayout | null;
  activeNodeKeyFromEditor: string | null;
  selectedNodeKey: string | null;
  hoveredEdgeKey: string | null;
  hoveredTraceNodeKey: string | null;
  overviewNodeMetadataByKey?: Map<string, OverviewNodeMetadata>;
  overviewScenarioMetadataByScenario?: Map<ParsedScenario, OverviewScenarioMetadata>;
  overviewCrossSliceLinks?: OverviewCrossSliceLink[];
  measuredScenarioGroupWidths?: Record<string, number>;
  canvasMargin?: number;
  laneLabelLeft?: number;
};

function computeCanvasViewport(
  activeLayout: LayoutResult,
  displayedPos: Record<string, Position>,
  renderedEdges: RenderedDiagramEdge[],
  title: DiagramTitle | null,
  sliceFrames: DiagramSliceFrame[],
  canvasMargin: number,
  scenarioCount: number,
  scenarioGroups: DiagramScenarioGroup[]
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

  if (title) {
    minX = Math.min(minX, title.left);
    minY = Math.min(minY, title.top);
  }

  for (const frame of sliceFrames) {
    minX = Math.min(minX, frame.left, frame.labelLeft);
    minY = Math.min(minY, frame.top, frame.labelTop);
    maxX = Math.max(maxX, frame.left + frame.width);
    maxY = Math.max(maxY, frame.top + frame.height);
  }

  if (scenarioGroups.length > 0) {
    for (const group of scenarioGroups) {
      minX = Math.min(minX, group.left);
      minY = Math.min(minY, group.top);
      maxX = Math.max(maxX, group.left + group.width);
      maxY = Math.max(maxY, group.top + group.height);
    }
  } else if (scenarioCount > 0) {
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

function buildOverviewSliceFrames(
  displayedPos: Record<string, Position>,
  visibleNodeKeys: Set<string>,
  overviewNodeMetadataByKey?: Map<string, OverviewNodeMetadata>
): DiagramSliceFrame[] {
  if (!overviewNodeMetadataByKey || overviewNodeMetadataByKey.size === 0) {
    return [];
  }

  const sliceBounds = new Map<string, {
    label: string;
    minX: number;
    minY: number;
    maxX: number;
    maxY: number;
  }>();

  for (const key of visibleNodeKeys) {
    const position = displayedPos[key];
    const metadata = overviewNodeMetadataByKey.get(key);
    if (!position || !metadata) {
      continue;
    }

    const existing = sliceBounds.get(metadata.sourceSliceId);
    sliceBounds.set(metadata.sourceSliceId, {
      label: metadata.sourceSliceName,
      minX: existing ? Math.min(existing.minX, position.x) : position.x,
      minY: existing ? Math.min(existing.minY, position.y) : position.y,
      maxX: existing ? Math.max(existing.maxX, position.x + position.w) : position.x + position.w,
      maxY: existing ? Math.max(existing.maxY, position.y + position.h) : position.y + position.h
    });
  }

  return [...sliceBounds.entries()].map(([sliceId, bounds]) => {
    const left = bounds.minX - OVERVIEW_SLICE_FRAME_PADDING_X;
    const top = bounds.minY - OVERVIEW_SLICE_FRAME_PADDING_TOP;
    return {
      key: `overview-slice-frame-${sliceId}`,
      label: bounds.label,
      left,
      top,
      width: (bounds.maxX - bounds.minX) + OVERVIEW_SLICE_FRAME_PADDING_X * 2,
      height: (bounds.maxY - bounds.minY) + OVERVIEW_SLICE_FRAME_PADDING_TOP + OVERVIEW_SLICE_FRAME_PADDING_BOTTOM,
      labelLeft: left,
      labelTop: top - OVERVIEW_SLICE_FRAME_LABEL_GAP - OVERVIEW_SLICE_FRAME_LABEL_HEIGHT
    };
  });
}

function buildLanes(
  parsed: Parsed,
  activeLayout: LayoutResult,
  engineLayout: DiagramEngineLayout | null,
  displayedPos: Record<string, Position>,
  visibleNodeKeys: Set<string>,
  labelLeft: number
): DiagramLane[] {
  const rowBuckets = new Map<number, { minY: number; streamLabel: string }>();
  const laneByKey = engineLayout?.laneByKey ?? new Map<string, number>();
  for (const node of parsed.nodes.values()) {
    if (!visibleNodeKeys.has(node.key)) {
      continue;
    }
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

function toScenarioNode(
  entry: Parsed['scenarios'][number]['given'][number],
  parsed: Parsed,
  activeNodeKeyFromEditor: string | null,
  selectedNodeKey: string | null
): DiagramScenarioNode {
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
  const highlighted = activeNodeKeyFromEditor === entry.key;
  const selected = selectedNodeKey === entry.key;
  const className = [
    highlighted ? 'highlighted' : '',
    selected ? 'selected' : ''
  ].filter(Boolean).join(' ');
  return {
    key: entry.key,
    node: scenarioNode,
    nodePrefix: prefix,
    className,
    type,
    title,
    prefix,
    srcRange: entry.srcRange,
    highlighted,
    selected
  };
}

function buildScenarios(parsed: Parsed, activeNodeKeyFromEditor: string | null, selectedNodeKey: string | null): DiagramScenario[] {
  return parsed.scenarios.map((scenario) => ({
    name: scenario.name,
    srcRange: scenario.srcRange,
    given: scenario.given.map((entry) => toScenarioNode(entry, parsed, activeNodeKeyFromEditor, selectedNodeKey)),
    when: scenario.when ? toScenarioNode(scenario.when, parsed, activeNodeKeyFromEditor, selectedNodeKey) : null,
    then: scenario.then.map((entry) => toScenarioNode(entry, parsed, activeNodeKeyFromEditor, selectedNodeKey))
  }));
}

function buildScenarioGroups(
  parsed: Parsed,
  scenarios: DiagramScenario[],
  sliceFrames: DiagramSliceFrame[],
  overviewScenarioMetadataByScenario?: Map<ParsedScenario, OverviewScenarioMetadata>,
  measuredScenarioGroupWidths: Record<string, number> = {}
): DiagramScenarioGroup[] {
  if (!overviewScenarioMetadataByScenario || overviewScenarioMetadataByScenario.size === 0) {
    return [];
  }

  const sliceFrameById = new Map(
    sliceFrames.map((frame) => [
      frame.key.replace('overview-slice-frame-', ''),
      frame
    ])
  );
  const grouped = new Map<string, {
    sliceName: string;
    frame: DiagramSliceFrame;
    scenarios: DiagramScenario[];
  }>();

  for (const [index, parsedScenario] of parsed.scenarios.entries()) {
    const metadata = overviewScenarioMetadataByScenario.get(parsedScenario);
    const scenario = scenarios[index];
    if (!metadata || !scenario) {
      continue;
    }
    const frame = sliceFrameById.get(metadata.sourceSliceId);
    if (!frame) {
      continue;
    }
    const existing = grouped.get(metadata.sourceSliceId);
    if (existing) {
      existing.scenarios.push(scenario);
      continue;
    }
    grouped.set(metadata.sourceSliceId, {
      sliceName: metadata.sourceSliceName,
      frame,
      scenarios: [scenario]
    });
  }

  return [...grouped.entries()].map(([sliceId, group]) => {
    const key = `overview-scenario-group-${sliceId}`;
    return {
      key,
    sliceId,
    sliceName: group.sliceName,
    left: group.frame.left,
    top: group.frame.top + group.frame.height + SCENARIO_AREA_TOP_GAP,
    width: Math.max(group.frame.width, measuredScenarioGroupWidths[key] ?? 0),
    height: (group.scenarios.length * SCENARIO_BOX_HEIGHT)
      + (Math.max(0, group.scenarios.length - 1) * SCENARIO_BOX_GAP)
      + SCENARIO_AREA_BOTTOM_PADDING,
    scenarios: group.scenarios
    };
  });
}

function nodeCenterRight(position: Position) {
  return {
    x: position.x + position.w,
    y: position.y + position.h / 2
  };
}

function nodeCenterLeft(position: Position) {
  return {
    x: position.x,
    y: position.y + position.h / 2
  };
}

export function buildSceneModel(input: BuildSceneModelInput): DiagramSceneModel | null {
  const {
    parsed,
    activeLayout,
    displayedPos,
    renderedEdges,
    engineLayout,
    activeNodeKeyFromEditor,
    selectedNodeKey,
    hoveredEdgeKey,
    hoveredTraceNodeKey,
    overviewNodeMetadataByKey,
    overviewScenarioMetadataByScenario,
    overviewCrossSliceLinks = [],
    measuredScenarioGroupWidths = {},
    canvasMargin = DEFAULT_CANVAS_MARGIN,
    laneLabelLeft = Math.max(8, PAD_X - 48)
  } = input;

  if (!parsed || !activeLayout) {
    return null;
  }

  const scenarioOnlyNodeKeys = new Set(parsed.scenarioOnlyNodeKeys);
  const visibleNodeKeys = new Set([...parsed.nodes.keys()].filter((key) => !scenarioOnlyNodeKeys.has(key)));
  const lanes = buildLanes(parsed, activeLayout, engineLayout, displayedPos, visibleNodeKeys, laneLabelLeft);
  const visibleDisplayedPos: Record<string, Position> = {};
  for (const [key, position] of Object.entries(displayedPos)) {
    if (visibleNodeKeys.has(key)) {
      visibleDisplayedPos[key] = position;
    }
  }
  const boundaries = buildBoundaries(parsed, visibleDisplayedPos, lanes, activeLayout.h);
  const sliceFrames = buildOverviewSliceFrames(visibleDisplayedPos, visibleNodeKeys, overviewNodeMetadataByKey);
  const scenarios = buildScenarios(parsed, activeNodeKeyFromEditor, selectedNodeKey);
  const scenarioGroups = buildScenarioGroups(
    parsed,
    scenarios,
    sliceFrames,
    overviewScenarioMetadataByScenario,
    measuredScenarioGroupWidths
  );
  const title: DiagramTitle | null = sliceFrames.length === 0 && parsed.sliceName
    ? { text: parsed.sliceName, top: 6, left: PAD_X }
    : null;
  const viewport = computeCanvasViewport(
    activeLayout,
    displayedPos,
    renderedEdges,
    title,
    sliceFrames,
    canvasMargin,
    parsed.scenarios.length,
    scenarioGroups
  );

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
      related: isHovered
    };
  });

  const crossSliceLinks = overviewCrossSliceLinks.flatMap((link) => {
    const fromPosition = displayedPos[link.fromOverviewNodeKey];
    const toPosition = displayedPos[link.toOverviewNodeKey];
    if (!fromPosition || !toPosition) {
      return [];
    }

    return [{
      key: link.key,
      logicalRef: link.logicalRef,
      renderMode: link.renderMode,
      fromNodeKey: link.fromOverviewNodeKey,
      toNodeKey: link.toOverviewNodeKey,
      ...(link.renderMode === 'dashed-connector'
        ? {
            points: [
              nodeCenterRight(fromPosition),
              nodeCenterLeft(toPosition)
            ]
          }
        : {})
    }];
  });

  const sharedNodeAnchors = overviewCrossSliceLinks.flatMap((link) => {
    if (link.renderMode !== 'shared-node') {
      return [];
    }
    const fromPosition = displayedPos[link.fromOverviewNodeKey];
    const toPosition = displayedPos[link.toOverviewNodeKey];
    if (!fromPosition || !toPosition) {
      return [];
    }

    return [{
      key: link.key,
      logicalRef: link.logicalRef,
      leftSliceNodeKey: link.fromOverviewNodeKey,
      rightSliceNodeKey: link.toOverviewNodeKey,
      x: fromPosition.x,
      y: fromPosition.y
    }];
  });

  return {
    nodes,
    edges,
    crossSliceLinks,
    sharedNodeAnchors,
    lanes,
    boundaries,
    scenarios,
    scenarioGroups,
    worldWidth: activeLayout.w,
    worldHeight: activeLayout.h,
    title,
    sliceFrames,
    viewport
  };
}
