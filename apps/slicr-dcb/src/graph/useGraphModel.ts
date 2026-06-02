import {IndexedDBEventStore} from '@slicr/event-sourcing';
import type {EdgeInput, LaneInput} from 'layout-lib';
import {useCallback, useEffect, useRef, useState} from 'react';

import type {DomainEvent} from '../domain/events';
import {createEventSourcedGraphModel, type AsyncGraphEventStore, type EventSourcedGraphModel} from './eventSourcedGraphModel';
import {getLaneOrder, getSuccessorNodeType} from './graphUtils';
import type {AddDirection, GraphNode, NodeType} from './types';

export type StoredGraphModel = {
  nodes: GraphNode[];
  edges: EdgeInput[];
  lanes: LaneInput[];
};

const LAST_OK_STORAGE_KEY = 'slicr-dcb.lastOkGraphModel.v1';
const EVENT_STORE_DATABASE_NAME = 'slicr-dcb.events.v1';
const EVENT_STORE_STREAM_NAME = 'graph';
const emptyGraphModel: StoredGraphModel = {nodes: [], edges: [], lanes: []};

class InMemoryAsyncGraphEventStore implements AsyncGraphEventStore {
  private events: DomainEvent[] = [];

  async append(events: DomainEvent | readonly DomainEvent[]) {
    this.events.push(...(Array.isArray(events) ? events : [events]));
  }

  async readAll() {
    return [...this.events];
  }

  async replace(events: readonly DomainEvent[]) {
    this.events = [...events];
  }

  async clear() {
    this.events = [];
  }
}

async function createDefaultGraphEventStore(): Promise<AsyncGraphEventStore> {
  if (typeof indexedDB === 'undefined') {
    return new InMemoryAsyncGraphEventStore();
  }

  return IndexedDBEventStore.create<DomainEvent>({
    databaseName: EVENT_STORE_DATABASE_NAME,
    streamName: EVENT_STORE_STREAM_NAME,
  });
}

export function storeLastOkGraphModel(model: StoredGraphModel) {
  if (typeof window === 'undefined') {
    return;
  }

  try {
    window.localStorage.setItem(LAST_OK_STORAGE_KEY, JSON.stringify(model));
  } catch {
    // Ignore storage errors so the editor remains usable in private browsing or full storage scenarios.
  }
}

function readLastOkGraphModel(): StoredGraphModel {
  if (typeof window === 'undefined') {
    return emptyGraphModel;
  }

  try {
    const rawModel = window.localStorage.getItem(LAST_OK_STORAGE_KEY);
    if (!rawModel) {
      return emptyGraphModel;
    }

    const parsedModel = JSON.parse(rawModel) as Partial<StoredGraphModel>;
    if (!isStoredGraphModel(parsedModel)) {
      return emptyGraphModel;
    }

    return parsedModel;
  } catch {
    return emptyGraphModel;
  }
}

export function isStoredGraphModel(model: unknown): model is StoredGraphModel {
  if (!model || typeof model !== 'object') {
    return false;
  }

  const candidate = model as Partial<StoredGraphModel>;
  return (
    Array.isArray(candidate.nodes) &&
    candidate.nodes.every(isGraphNode) &&
    Array.isArray(candidate.edges) &&
    candidate.edges.every(isEdgeInput) &&
    Array.isArray(candidate.lanes) &&
    candidate.lanes.every(isLaneInput)
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
  return type === 'ui' || type === 'cmd' || type === 'evt' || type === 'rm' || type === 'dm' || type === 'processor';
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
  const modelRef = useRef<EventSourcedGraphModel | null>(null);

  const [nodes, setNodes] = useState<GraphNode[]>([]);
  const [edges, setEdges] = useState<EdgeInput[]>([]);
  const [lanes, setLanes] = useState<LaneInput[]>([]);
  const [focusedNodeId, setFocusedNodeId] = useState<string | null>(null);
  const [editingNodeId, setEditingNodeId] = useState<string | null>(null);
  const [draftLabel, setDraftLabel] = useState('');
  const [originalLabel, setOriginalLabel] = useState('');
  const [openNodeMenuId, setOpenNodeMenuId] = useState<string | null>(null);
  const [connectingSourceNodeId, setConnectingSourceNodeId] = useState<string | null>(null);

  const applyGraphModel = useCallback((graphModel: StoredGraphModel) => {
    setNodes(graphModel.nodes);
    setEdges(graphModel.edges);
    setLanes(graphModel.lanes);
  }, []);

  const resetTransientState = useCallback(() => {
    setEditingNodeId(null);
    setDraftLabel('');
    setOriginalLabel('');
    setOpenNodeMenuId(null);
    setConnectingSourceNodeId(null);
    skipBlurSaveRef.current = false;
    cancelEditRef.current = false;
  }, []);

  useEffect(() => {
    let cancelled = false;

    const loadModel = async () => {
      const store = await createDefaultGraphEventStore();
      const model = createEventSourcedGraphModel({store});
      const graphModel = await model.load();
      if (cancelled) {
        return;
      }

      modelRef.current = model;
      applyGraphModel(graphModel);
      setFocusedNodeId(graphModel.nodes[0]?.id ?? null);
    };

    void loadModel();
    return () => {
      cancelled = true;
    };
  }, [applyGraphModel]);

  const replaceGraphModel = useCallback(
    (graphModel: StoredGraphModel) => {
      applyGraphModel(graphModel);
      setFocusedNodeId(graphModel.nodes[0]?.id ?? null);
      resetTransientState();
    },
    [applyGraphModel, resetTransientState],
  );

  const revertToLastOkGraphModel = useCallback(() => {
    replaceGraphModel(readLastOkGraphModel());
  }, [replaceGraphModel]);

  const addNewSlice = useCallback(() => {
    void (async () => {
      const graphModel = await modelRef.current?.addNewSlice();
      if (!graphModel) {
        return;
      }
      applyGraphModel(graphModel);
      const newNode = graphModel.nodes[graphModel.nodes.length - 1];
      if (!newNode) {
        return;
      }
      setFocusedNodeId(newNode.id);
      setOpenNodeMenuId(null);
      setConnectingSourceNodeId(null);
      skipBlurSaveRef.current = false;
      cancelEditRef.current = false;
      setEditingNodeId(newNode.id);
      setDraftLabel(newNode.label);
      setOriginalLabel(newNode.label);
    })();
  }, [applyGraphModel]);

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

      const role = wouldCreateCycle(edges, sourceNodeId, targetNodeId) ? 'back-reference' : undefined;
      void (async () => {
        const graphModel = await modelRef.current?.addConnection(sourceNodeId, targetNodeId, role);
        if (graphModel) {
          applyGraphModel(graphModel);
        }
        setConnectingSourceNodeId(null);
        setFocusedNodeId(targetNodeId);
        setOpenNodeMenuId(null);
      })();
    },
    [applyGraphModel, edges],
  );

  const deleteConnection = useCallback(
    (edgeId: string) => {
      void (async () => {
        const graphModel = await modelRef.current?.deleteConnection(edgeId);
        if (graphModel) {
          applyGraphModel(graphModel);
        }
      })();
    },
    [applyGraphModel],
  );

  const addConnectedNode = useCallback(
    (sourceNode: GraphNode, direction: AddDirection, typeOverride?: NodeType) => {
      const sourceLaneOrder = getLaneOrder(lanes, sourceNode.laneId);
      const targetLaneOrder =
        direction === 'top' ? sourceLaneOrder - 1 : direction === 'bottom' ? sourceLaneOrder + 1 : sourceLaneOrder;
      const targetType = typeOverride ?? getSuccessorNodeType(sourceNode.type, direction);
      const newNodeNumber = Math.max(0, ...nodes.map((node) => Number(node.id.replace('node-', '')) || 0)) + 1;
      const label = `Node ${newNodeNumber}`;

      void (async () => {
        const graphModel = await modelRef.current?.addConnectedNode({
          sourceNodeId: sourceNode.id,
          nodeType: targetType,
          laneId: targetLaneOrder,
          label,
        });
        if (!graphModel) {
          return;
        }

        applyGraphModel(graphModel);
        const newNode = graphModel.nodes.find((node) => node.label === label) ?? graphModel.nodes[graphModel.nodes.length - 1];
        if (!newNode) {
          return;
        }
        setFocusedNodeId(newNode.id);
        setConnectingSourceNodeId(null);
        skipBlurSaveRef.current = false;
        cancelEditRef.current = false;
        setEditingNodeId(newNode.id);
        setDraftLabel(newNode.label);
        setOriginalLabel(newNode.label);
      })();
    },
    [applyGraphModel, lanes, nodes],
  );

  const deleteNode = useCallback(
    (nodeId: string) => {
      const predecessorNodeId = edges.find((edge) => edge.targetId === nodeId)?.sourceId ?? null;

      void (async () => {
        const graphModel = await modelRef.current?.deleteNode(nodeId);
        if (graphModel) {
          applyGraphModel(graphModel);
        }
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
      })();
    },
    [applyGraphModel, connectingSourceNodeId, edges, editingNodeId, focusedNodeId, openNodeMenuId],
  );

  const setNodeType = useCallback(
    (nodeId: string, type: NodeType) => {
      void (async () => {
        const graphModel = await modelRef.current?.setNodeType(nodeId, type);
        if (graphModel) {
          applyGraphModel(graphModel);
        }
        setOpenNodeMenuId(null);
      })();
    },
    [applyGraphModel],
  );

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

    const nodeId = editingNodeId;
    const nextLabel = draftLabel.trim() || 'Untitled';
    void (async () => {
      const graphModel = await modelRef.current?.renameNode(nodeId, nextLabel);
      if (graphModel) {
        applyGraphModel(graphModel);
      }
      cancelEditRef.current = false;
      setEditingNodeId(null);
      setDraftLabel('');
      setOriginalLabel('');
    })();
  }, [applyGraphModel, draftLabel, editingNodeId]);

  const cancelEditingNode = useCallback(() => {
    cancelEditRef.current = true;
    if (editingNodeId) {
      setNodes((currentNodes) =>
        currentNodes.map((node) => (node.id === editingNodeId ? {...node, label: originalLabel} : node)),
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

    if (typeof document !== 'undefined' && document.activeElement === document.body) {
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
    if (!editingNodeId || typeof document === 'undefined') {
      return;
    }

    const saveWhenClickingOutsideTextBox = (event: PointerEvent) => {
      if (event.target instanceof Element && event.target.closest('.node-label-input')) {
        return;
      }

      skipBlurSaveRef.current = true;
      saveEditingNode();
    };

    document.addEventListener('pointerdown', saveWhenClickingOutsideTextBox, {capture: true});
    return () => document.removeEventListener('pointerdown', saveWhenClickingOutsideTextBox, {capture: true});
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
    replaceGraphModel,
    revertToLastOkGraphModel,
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
