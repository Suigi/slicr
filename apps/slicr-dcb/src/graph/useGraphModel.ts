import { useCallback, useEffect, useRef, useState } from 'react';
import type { EdgeInput, LaneInput } from 'layout-lib';
import { initialLane, laneIdForOrder, NODE_HEIGHT, NODE_WIDTH } from './constants';
import type { AddDirection, GraphNode, NodeType } from './types';
import { ensureLane, getLaneOrder, getSuccessorNodeType } from './graphUtils';

type StoredGraphModel = {
  nodes: GraphNode[];
  edges: EdgeInput[];
  lanes: LaneInput[];
};

const STORAGE_KEY = 'slicr-dcb.graphModel.v1';

const defaultGraphModel: StoredGraphModel = {
  nodes: [
    {
      id: 'node-1',
      label: 'Node 1',
      type: 'ui',
      laneId: initialLane.id,
      width: NODE_WIDTH,
      height: NODE_HEIGHT,
    },
  ],
  edges: [],
  lanes: [initialLane],
};

function readStoredGraphModel(): StoredGraphModel {
  if (typeof window === 'undefined') {
    return defaultGraphModel;
  }

  try {
    const rawModel = window.localStorage.getItem(STORAGE_KEY);
    if (!rawModel) {
      return defaultGraphModel;
    }

    const parsedModel = JSON.parse(rawModel) as Partial<StoredGraphModel>;
    if (!isStoredGraphModel(parsedModel)) {
      return defaultGraphModel;
    }

    return parsedModel;
  } catch {
    return defaultGraphModel;
  }
}

function isStoredGraphModel(model: Partial<StoredGraphModel>): model is StoredGraphModel {
  return (
    Array.isArray(model.nodes) &&
    model.nodes.length > 0 &&
    model.nodes.every(isGraphNode) &&
    Array.isArray(model.edges) &&
    model.edges.every(isEdgeInput) &&
    Array.isArray(model.lanes) &&
    model.lanes.length > 0 &&
    model.lanes.every(isLaneInput)
  );
}

function isGraphNode(node: unknown): node is GraphNode {
  if (!node || typeof node !== 'object') {
    return false;
  }

  const candidate = node as Partial<GraphNode>;
  return (
    typeof candidate.id === 'string' &&
    typeof candidate.label === 'string' &&
    isNodeType(candidate.type) &&
    typeof candidate.laneId === 'string' &&
    typeof candidate.width === 'number' &&
    typeof candidate.height === 'number'
  );
}

function isEdgeInput(edge: unknown): edge is EdgeInput {
  if (!edge || typeof edge !== 'object') {
    return false;
  }

  const candidate = edge as Partial<EdgeInput>;
  return typeof candidate.id === 'string' && typeof candidate.sourceId === 'string' && typeof candidate.targetId === 'string';
}

function isLaneInput(lane: unknown): lane is LaneInput {
  if (!lane || typeof lane !== 'object') {
    return false;
  }

  const candidate = lane as Partial<LaneInput>;
  return typeof candidate.id === 'string' && typeof candidate.order === 'number';
}

function isNodeType(type: unknown): type is NodeType {
  return type === 'ui' || type === 'cmd' || type === 'evt' || type === 'rm';
}

function wouldCreateCycle(edges: EdgeInput[], sourceNodeId: string, targetNodeId: string) {
  const outgoingNodeIdsBySourceId = new Map<string, string[]>();
  for (const edge of edges) {
    const outgoingNodeIds = outgoingNodeIdsBySourceId.get(edge.sourceId) ?? [];
    outgoingNodeIds.push(edge.targetId);
    outgoingNodeIdsBySourceId.set(edge.sourceId, outgoingNodeIds);
  }

  const visitedNodeIds = new Set<string>();
  const nodeIdsToVisit = [targetNodeId];
  while (nodeIdsToVisit.length > 0) {
    const currentNodeId = nodeIdsToVisit.pop();
    if (!currentNodeId || visitedNodeIds.has(currentNodeId)) {
      continue;
    }
    if (currentNodeId === sourceNodeId) {
      return true;
    }

    visitedNodeIds.add(currentNodeId);
    nodeIdsToVisit.push(...(outgoingNodeIdsBySourceId.get(currentNodeId) ?? []));
  }

  return false;
}

export function useGraphModel() {
  const skipBlurSaveRef = useRef(false);
  const cancelEditRef = useRef(false);
  const initialGraphModelRef = useRef<StoredGraphModel | null>(null);
  if (!initialGraphModelRef.current) {
    initialGraphModelRef.current = readStoredGraphModel();
  }

  const [nodes, setNodes] = useState<GraphNode[]>(() => initialGraphModelRef.current?.nodes ?? defaultGraphModel.nodes);
  const [edges, setEdges] = useState<EdgeInput[]>(() => initialGraphModelRef.current?.edges ?? defaultGraphModel.edges);
  const [lanes, setLanes] = useState<LaneInput[]>(() => initialGraphModelRef.current?.lanes ?? defaultGraphModel.lanes);
  const [focusedNodeId, setFocusedNodeId] = useState<string | null>(() => initialGraphModelRef.current?.nodes[0]?.id ?? null);
  const [editingNodeId, setEditingNodeId] = useState<string | null>(null);
  const [draftLabel, setDraftLabel] = useState('');
  const [originalLabel, setOriginalLabel] = useState('');
  const [openNodeMenuId, setOpenNodeMenuId] = useState<string | null>(null);
  const [connectingSourceNodeId, setConnectingSourceNodeId] = useState<string | null>(null);

  useEffect(() => {
    try {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify({ nodes, edges, lanes }));
    } catch {
      // Ignore storage errors so the editor remains usable in private browsing or full storage scenarios.
    }
  }, [edges, lanes, nodes]);

  const addNewSlice = useCallback(() => {
    const newNodeNumber = Math.max(0, ...nodes.map((node) => Number(node.id.replace('node-', '')) || 0)) + 1;
    const newNodeId = `node-${newNodeNumber}`;
    const label = `Node ${newNodeNumber}`;

    setLanes((currentLanes) => ensureLane(currentLanes, initialLane.order));
    setNodes((currentNodes) => [
      ...currentNodes,
      {
        id: newNodeId,
        label,
        type: 'ui',
        laneId: initialLane.id,
        width: NODE_WIDTH,
        height: NODE_HEIGHT,
      },
    ]);
    setFocusedNodeId(newNodeId);
    setOpenNodeMenuId(null);
    setConnectingSourceNodeId(null);
    skipBlurSaveRef.current = false;
    cancelEditRef.current = false;
    setEditingNodeId(newNodeId);
    setDraftLabel(label);
    setOriginalLabel(label);
  }, [nodes]);

  const startConnectingFromNode = useCallback((nodeId: string) => {
    setFocusedNodeId(nodeId);
    setOpenNodeMenuId(null);
    setConnectingSourceNodeId(nodeId);
  }, []);

  const cancelConnecting = useCallback(() => {
    setConnectingSourceNodeId(null);
  }, []);

  const addConnection = useCallback(
    (sourceNodeId: string, targetNodeId: string) => {
      if (sourceNodeId === targetNodeId) {
        return;
      }
      if (edges.some((edge) => edge.sourceId === sourceNodeId && edge.targetId === targetNodeId)) {
        setConnectingSourceNodeId(null);
        setFocusedNodeId(targetNodeId);
        return;
      }
      if (wouldCreateCycle(edges, sourceNodeId, targetNodeId)) {
        return;
      }

      const edgeIdBase = `edge-${sourceNodeId}-${targetNodeId}`;
      const existingEdgeIds = new Set(edges.map((edge) => edge.id));
      let edgeId = edgeIdBase;
      let suffix = 2;
      while (existingEdgeIds.has(edgeId)) {
        edgeId = `${edgeIdBase}-${suffix}`;
        suffix += 1;
      }

      setEdges((currentEdges) => [...currentEdges, { id: edgeId, sourceId: sourceNodeId, targetId: targetNodeId }]);
      setConnectingSourceNodeId(null);
      setFocusedNodeId(targetNodeId);
      setOpenNodeMenuId(null);
    },
    [edges],
  );

  const deleteConnection = useCallback((edgeId: string) => {
    setEdges((currentEdges) => currentEdges.filter((edge) => edge.id !== edgeId));
  }, []);

  const addConnectedNode = useCallback(
    (sourceNode: GraphNode, direction: AddDirection, typeOverride?: NodeType) => {
      const sourceLaneOrder = getLaneOrder(lanes, sourceNode.laneId);
      const targetLaneOrder =
        direction === 'top' ? sourceLaneOrder - 1 : direction === 'bottom' ? sourceLaneOrder + 1 : sourceLaneOrder;
      const targetLaneId = laneIdForOrder(targetLaneOrder);
      const targetType = typeOverride ?? getSuccessorNodeType(sourceNode.type, direction);
      const newNodeNumber = Math.max(0, ...nodes.map((node) => Number(node.id.replace('node-', '')) || 0)) + 1;
      const newNodeId = `node-${newNodeNumber}`;

      setLanes((currentLanes) => ensureLane(currentLanes, targetLaneOrder));
      setNodes((currentNodes) => [
        ...currentNodes,
        {
          id: newNodeId,
          label: `Node ${newNodeNumber}`,
          type: targetType,
          laneId: targetLaneId,
          width: NODE_WIDTH,
          height: NODE_HEIGHT,
        },
      ]);
      setEdges((currentEdges) => [
        ...currentEdges,
        { id: `edge-${sourceNode.id}-${newNodeId}`, sourceId: sourceNode.id, targetId: newNodeId },
      ]);
      setFocusedNodeId(newNodeId);
      setConnectingSourceNodeId(null);
      skipBlurSaveRef.current = false;
      cancelEditRef.current = false;
      setEditingNodeId(newNodeId);
      setDraftLabel(`Node ${newNodeNumber}`);
      setOriginalLabel(`Node ${newNodeNumber}`);
    },
    [lanes, nodes],
  );

  const deleteNode = useCallback(
    (nodeId: string) => {
      const predecessorNodeId = edges.find((edge) => edge.targetId === nodeId)?.sourceId ?? null;

      setNodes((currentNodes) => currentNodes.filter((node) => node.id !== nodeId));
      setEdges((currentEdges) => currentEdges.filter((edge) => edge.sourceId !== nodeId && edge.targetId !== nodeId));
      if (editingNodeId === nodeId) {
        setEditingNodeId(null);
        setDraftLabel('');
        setOriginalLabel('');
      }
      if (openNodeMenuId === nodeId) {
        setOpenNodeMenuId(null);
      }
      if (connectingSourceNodeId === nodeId) {
        setConnectingSourceNodeId(null);
      }
      if (focusedNodeId === nodeId) {
        setFocusedNodeId(predecessorNodeId);
      }
    },
    [connectingSourceNodeId, edges, editingNodeId, focusedNodeId, openNodeMenuId],
  );

  const setNodeType = useCallback((nodeId: string, type: NodeType) => {
    setNodes((currentNodes) => currentNodes.map((node) => (node.id === nodeId ? { ...node, type } : node)));
    setOpenNodeMenuId(null);
  }, []);

  const startEditingNode = useCallback((node: GraphNode) => {
    skipBlurSaveRef.current = false;
    cancelEditRef.current = false;
    setFocusedNodeId(node.id);
    setConnectingSourceNodeId(null);
    setEditingNodeId(node.id);
    setDraftLabel(node.label);
    setOriginalLabel(node.label);
  }, []);

  const saveEditingNode = useCallback(() => {
    if (!editingNodeId || cancelEditRef.current) {
      return;
    }

    const nextLabel = draftLabel.trim() || 'Untitled';
    setNodes((currentNodes) =>
      currentNodes.map((node) => (node.id === editingNodeId ? { ...node, label: nextLabel } : node)),
    );
    cancelEditRef.current = false;
    setEditingNodeId(null);
    setDraftLabel('');
    setOriginalLabel('');
  }, [draftLabel, editingNodeId]);

  const cancelEditingNode = useCallback(() => {
    cancelEditRef.current = true;
    if (editingNodeId) {
      setNodes((currentNodes) =>
        currentNodes.map((node) => (node.id === editingNodeId ? { ...node, label: originalLabel } : node)),
      );
    }
    setEditingNodeId(null);
    setDraftLabel('');
    setOriginalLabel('');
  }, [editingNodeId, originalLabel]);

  const handleLabelBlur = useCallback(() => {
    if (skipBlurSaveRef.current) {
      skipBlurSaveRef.current = false;
      cancelEditRef.current = false;
      return;
    }

    if (document.activeElement === document.body) {
      cancelEditingNode();
      return;
    }

    saveEditingNode();
  }, [cancelEditingNode, saveEditingNode]);

  const cancelEditingFromKeyboard = useCallback(() => {
    skipBlurSaveRef.current = true;
    cancelEditingNode();
  }, [cancelEditingNode]);

  useEffect(() => {
    if (!editingNodeId) {
      return;
    }

    const saveWhenClickingOutsideTextBox = (event: PointerEvent) => {
      if (event.target instanceof Element && event.target.closest('.node-label-input')) {
        return;
      }

      skipBlurSaveRef.current = true;
      saveEditingNode();
    };

    document.addEventListener('pointerdown', saveWhenClickingOutsideTextBox, { capture: true });
    return () => document.removeEventListener('pointerdown', saveWhenClickingOutsideTextBox, { capture: true });
  }, [editingNodeId, saveEditingNode]);

  return {
    nodes,
    edges,
    lanes,
    focusedNodeId,
    editingNodeId,
    draftLabel,
    openNodeMenuId,
    connectingSourceNodeId,
    setFocusedNodeId,
    setDraftLabel,
    setOpenNodeMenuId,
    addNewSlice,
    startConnectingFromNode,
    cancelConnecting,
    addConnection,
    deleteConnection,
    addConnectedNode,
    deleteNode,
    setNodeType,
    startEditingNode,
    saveEditingNode,
    cancelEditingFromKeyboard,
    handleLabelBlur,
  };
}
