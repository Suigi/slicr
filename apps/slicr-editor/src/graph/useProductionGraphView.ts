import {useLayoutEffect, useMemo, useState, type RefObject} from 'react';
import {compactLayout, type EdgeInput, type LaneInput} from 'layout-lib';
import {NODE_HEIGHT, NODE_WIDTH} from './constants';
import {getArrowRenderPoints} from './graphUtils';
import type {GraphNode, RenderNode} from './types';
import {measureNodeDimensions, type NodeDimensions} from '../nodeMeasurement';

export function useProductionGraphView({
  nodes,
  edges,
  lanes,
  focusedNodeId,
  nodePropertiesById,
  editingNodeId,
  draftLabel,
  measurementRef,
}: {
  nodes: readonly GraphNode[];
  edges: readonly EdgeInput[];
  lanes: readonly LaneInput[];
  focusedNodeId: string | null;
  nodePropertiesById: Record<string, unknown>;
  editingNodeId: string | null;
  draftLabel: string;
  measurementRef: RefObject<HTMLDivElement | null>;
}) {
  const [measurements, setMeasurements] = useState<Record<string, NodeDimensions>>({});
  const [settledMeasurementKey, setSettledMeasurementKey] = useState('');
  const layoutNodes = useMemo(
    () =>
      nodes.map((node) => ({
        ...node,
        width: NODE_WIDTH,
        height: Math.max(NODE_HEIGHT, measurements[node.id]?.height ?? node.height),
      })),
    [nodes, measurements],
  );
  const layoutResult = useMemo(
    () =>
      compactLayout({
        nodes: layoutNodes,
        edges: [...edges],
        lanes: [...lanes],
        defaults: {nodeWidth: NODE_WIDTH, nodeHeight: NODE_HEIGHT},
        spacing: {laneMargin: 0, laneGap: 100, minTargetShift: 20, minNodeGap: 40},
      }),
    [layoutNodes, edges, lanes],
  );
  const renderedNodes: RenderNode[] = useMemo(() => {
    if (!layoutResult.ok) return [];
    const byId = new Map(layoutNodes.map((node) => [node.id, node]));
    return layoutResult.result.nodes.flatMap((position) => {
      const node = byId.get(position.id);
      return node ? [{...node, ...position}] : [];
    });
  }, [layoutNodes, layoutResult]);
  const renderedEdges = useMemo(
    () =>
      layoutResult.ok
        ? layoutResult.result.edges.flatMap((edge) => {
            const points = getArrowRenderPoints(edge.points);
            return points
              ? [
                  {
                    id: edge.id,
                    role: edge.role,
                    points,
                    isConnectedToFocusedNode: edge.sourceId === focusedNodeId || edge.targetId === focusedNodeId,
                  },
                ]
              : [];
          })
        : [],
    [layoutResult, focusedNodeId],
  );
  const measurementStateKey = useMemo(
    () => JSON.stringify({nodes, nodePropertiesById, editingNodeId, draftLabel}),
    [nodes, nodePropertiesById, editingNodeId, draftLabel],
  );
  useLayoutEffect(() => {
    let cancelled = false;
    queueMicrotask(() => {
      if (cancelled) return;
      const next = measureNodeDimensions(measurementRef.current ?? document);
      setMeasurements((current) => {
        const currentKeys = Object.keys(current);
        const nextKeys = Object.keys(next);
        return currentKeys.length === nextKeys.length &&
          currentKeys.every((id) => current[id]?.width === next[id]?.width && current[id]?.height === next[id]?.height)
          ? current
          : next;
      });
      setSettledMeasurementKey(measurementStateKey);
    });
    return () => {
      cancelled = true;
    };
  }, [measurementRef, measurementStateKey]);
  return {layoutNodes, layoutResult, renderedNodes, renderedEdges, isMeasurementSettled: settledMeasurementKey === measurementStateKey};
}
