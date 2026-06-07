import {IndexedDBEventStore} from '@slicr/event-sourcing';
import type {EditableProperty} from '@slicr/react-ui';
import type {EdgeInput, LaneInput} from 'layout-lib';
import {useCallback, useEffect, useMemo, useRef, useState} from 'react';

import type {DomainEvent, NodePropertyExampleValues, NodePropertySchema} from '../domain/events';
import type {WorkspaceProjection} from '../domain/workspaceProjector';
import {createEventSourcedGraphModel, type AsyncGraphEventStore, type EventSourcedGraphModel} from './eventSourcedGraphModel';
import {getLaneOrder, getSuccessorNodeType} from './graphUtils';
import {
  deriveNodePropertyExampleValues,
  deriveNodePropertySchema,
  mergeNodePropertyEditorProperties,
} from './propertyEventMapping';
import type {AddDirection, GraphNode, NodeType} from './types';

export type StoredGraphModel = {
  nodes: GraphNode[];
  edges: EdgeInput[];
  lanes: LaneInput[];
  nodeSchemas?: Record<string, NodePropertySchema[]>;
  nodeExampleValues?: Record<string, NodePropertyExampleValues[]>;
};

const LAST_OK_STORAGE_KEY = 'slicr-dcb.lastOkGraphModel.v1';
const EVENT_STORE_DATABASE_NAME = 'slicr-dcb.events.v1';
const EVENT_STORE_STREAM_NAME = 'graph';
const emptyGraphModel: StoredGraphModel = {nodes: [], edges: [], lanes: []};
const emptyWorkspace: WorkspaceProjection = {projects: [], chaptersByProjectId: {}};

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

export function useGraphModel(scope: {activeProjectId?: string | null; activeChapterId?: string | null} = {}) {
  const skipBlurSaveRef = useRef(false);
  const cancelEditRef = useRef(false);
  const modelRef = useRef<EventSourcedGraphModel | null>(null);
  const propertyDebounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const pendingPropertyEditRef = useRef<{nodeId: string; properties: EditableProperty[]} | null>(null);

  const [workspace, setWorkspace] = useState<WorkspaceProjection>(emptyWorkspace);
  const [resolvedProjectId, setResolvedProjectId] = useState('');
  const [resolvedChapterId, setResolvedChapterId] = useState('');
  const [nodes, setNodes] = useState<GraphNode[]>([]);
  const [edges, setEdges] = useState<EdgeInput[]>([]);
  const [lanes, setLanes] = useState<LaneInput[]>([]);
  const [nodeSchemas, setNodeSchemas] = useState<Record<string, NodePropertySchema[]>>({});
  const [nodeExampleValues, setNodeExampleValues] = useState<Record<string, NodePropertyExampleValues[]>>({});
  const [editorPropertiesById, setEditorPropertiesById] = useState<Record<string, EditableProperty[]>>({});
  const [focusedNodeId, setFocusedNodeIdState] = useState<string | null>(null);
  const [editingNodeId, setEditingNodeId] = useState<string | null>(null);
  const [draftLabel, setDraftLabel] = useState('');
  const [originalLabel, setOriginalLabel] = useState('');
  const [openNodeMenuId, setOpenNodeMenuId] = useState<string | null>(null);
  const [connectingSourceNodeId, setConnectingSourceNodeId] = useState<string | null>(null);

  const applyGraphModel = useCallback((graphModel: StoredGraphModel) => {
    setNodes(graphModel.nodes);
    setEdges(graphModel.edges);
    setLanes(graphModel.lanes);
    setNodeSchemas(graphModel.nodeSchemas ?? {});
    setNodeExampleValues(graphModel.nodeExampleValues ?? {});
    setEditorPropertiesById({});
  }, []);

  const syncWorkspaceState = useCallback(() => {
    const nextWorkspace = modelRef.current?.getWorkspace() ?? emptyWorkspace;
    const nextScope = modelRef.current?.getScope() ?? {projectId: '', chapterId: ''};
    setWorkspace(nextWorkspace);
    setResolvedProjectId(nextScope.projectId);
    setResolvedChapterId(nextScope.chapterId);
  }, []);

  const flushPendingPropertyEdit = useCallback(async () => {
    const pendingEdit = pendingPropertyEditRef.current;
    if (!pendingEdit || !modelRef.current) {
      return;
    }

    pendingPropertyEditRef.current = null;
    if (propertyDebounceRef.current) {
      clearTimeout(propertyDebounceRef.current);
      propertyDebounceRef.current = null;
    }

    const schema = deriveNodePropertySchema(pendingEdit.properties);
    const exampleValues = deriveNodePropertyExampleValues(pendingEdit.properties);
    let graphModel = await modelRef.current.changeNodeSchema({nodeId: pendingEdit.nodeId, schema});
    graphModel = await modelRef.current.changeNodeExampleValues({nodeId: pendingEdit.nodeId, exampleValues});
    applyGraphModel(graphModel);
    syncWorkspaceState();
    setFocusedNodeIdState((currentFocusedNodeId) => currentFocusedNodeId);
  }, [applyGraphModel, syncWorkspaceState]);

  const schedulePropertyEditFlush = useCallback(() => {
    if (propertyDebounceRef.current) {
      clearTimeout(propertyDebounceRef.current);
    }
    propertyDebounceRef.current = setTimeout(() => {
      void flushPendingPropertyEdit();
    }, 1000);
  }, [flushPendingPropertyEdit]);

  const setFocusedNodeId = useCallback((nodeId: string | null) => {
    if (pendingPropertyEditRef.current && pendingPropertyEditRef.current.nodeId !== nodeId) {
      void flushPendingPropertyEdit();
    }
    setFocusedNodeIdState(nodeId);
  }, [flushPendingPropertyEdit]);

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
      const graphModel = await model.load({
        projectId: scope.activeProjectId ?? undefined,
        chapterId: scope.activeChapterId ?? undefined,
      });
      if (cancelled) {
        return;
      }

      modelRef.current = model;
      applyGraphModel(graphModel);
      syncWorkspaceState();
      setFocusedNodeId(graphModel.nodes[0]?.id ?? null);
    };

    void loadModel();
    return () => {
      cancelled = true;
    };
  }, [applyGraphModel, scope.activeChapterId, scope.activeProjectId, setFocusedNodeId, syncWorkspaceState]);

  const replaceGraphModel = useCallback(
    (graphModel: StoredGraphModel) => {
      applyGraphModel(graphModel);
      setFocusedNodeId(graphModel.nodes[0]?.id ?? null);
      resetTransientState();
    },
    [applyGraphModel, resetTransientState, setFocusedNodeId],
  );

  useEffect(() => {
    if (!modelRef.current) {
      return;
    }

    const graphModel = modelRef.current.setScope({
      projectId: scope.activeProjectId ?? undefined,
      chapterId: scope.activeChapterId ?? undefined,
    });
    applyGraphModel(graphModel);
    syncWorkspaceState();
    setFocusedNodeId(graphModel.nodes[0]?.id ?? null);
    resetTransientState();
  }, [applyGraphModel, resetTransientState, scope.activeChapterId, scope.activeProjectId, setFocusedNodeId, syncWorkspaceState]);

  const readGraphEvents = useCallback(async () => modelRef.current?.readEvents() ?? [], []);

  const replaceGraphEvents = useCallback(
    async (events: readonly DomainEvent[]) => {
      await flushPendingPropertyEdit();
      const graphModel = await modelRef.current?.replace(events);
      if (!graphModel) {
        return;
      }

      applyGraphModel(graphModel);
      syncWorkspaceState();
      setFocusedNodeId(graphModel.nodes[0]?.id ?? null);
      resetTransientState();
    },
    [applyGraphModel, flushPendingPropertyEdit, resetTransientState, setFocusedNodeId, syncWorkspaceState],
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
      syncWorkspaceState();
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
  }, [applyGraphModel, setFocusedNodeId, syncWorkspaceState]);

  const startConnectingFromNode = useCallback((nodeId: string) => {
    setFocusedNodeId(nodeId);
    setOpenNodeMenuId(null);
    setConnectingSourceNodeId(nodeId);
  }, [setFocusedNodeId]);

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
          syncWorkspaceState();
        }
        setConnectingSourceNodeId(null);
        setFocusedNodeId(targetNodeId);
        setOpenNodeMenuId(null);
      })();
    },
    [applyGraphModel, edges, setFocusedNodeId, syncWorkspaceState],
  );

  const deleteConnection = useCallback(
    (edgeId: string) => {
      void (async () => {
        const graphModel = await modelRef.current?.deleteConnection(edgeId);
        if (graphModel) {
          applyGraphModel(graphModel);
          syncWorkspaceState();
        }
      })();
    },
    [applyGraphModel, syncWorkspaceState],
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
        syncWorkspaceState();
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
    [applyGraphModel, lanes, nodes, setFocusedNodeId, syncWorkspaceState],
  );

  const deleteNode = useCallback(
    (nodeId: string) => {
      const predecessorNodeId = edges.find((edge) => edge.targetId === nodeId)?.sourceId ?? null;

      void (async () => {
        const graphModel = await modelRef.current?.deleteNode(nodeId);
        if (graphModel) {
          applyGraphModel(graphModel);
          syncWorkspaceState();
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
    [applyGraphModel, connectingSourceNodeId, edges, editingNodeId, focusedNodeId, openNodeMenuId, setFocusedNodeId, syncWorkspaceState],
  );

  const setNodeType = useCallback(
    (nodeId: string, type: NodeType) => {
      void (async () => {
        const graphModel = await modelRef.current?.setNodeType(nodeId, type);
        if (graphModel) {
          applyGraphModel(graphModel);
          syncWorkspaceState();
        }
        setOpenNodeMenuId(null);
      })();
    },
    [applyGraphModel, syncWorkspaceState],
  );

  const startEditingNode = useCallback((node: GraphNode) => {
    skipBlurSaveRef.current = false;
    cancelEditRef.current = false;
    setFocusedNodeId(node.id);
    setConnectingSourceNodeId(null);
    setEditingNodeId(node.id);
    setDraftLabel(node.label);
    setOriginalLabel(node.label);
  }, [setFocusedNodeId]);

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
        syncWorkspaceState();
      }
      cancelEditRef.current = false;
      setEditingNodeId(null);
      setDraftLabel('');
      setOriginalLabel('');
    })();
  }, [applyGraphModel, draftLabel, editingNodeId, syncWorkspaceState]);

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

  useEffect(() => {
    return () => {
      void flushPendingPropertyEdit();
    };
  }, [flushPendingPropertyEdit]);

  const nodePropertiesById = useMemo(
    () =>
      Object.fromEntries(
        nodes.map((node) => [
          node.id,
          editorPropertiesById[node.id]
            ?? mergeNodePropertyEditorProperties(nodeSchemas[node.id] ?? [], nodeExampleValues[node.id] ?? []),
        ]),
      ),
    [editorPropertiesById, nodeExampleValues, nodeSchemas, nodes],
  );

  const focusedNodeProperties = useMemo(() => {
    if (!focusedNodeId) {
      return [];
    }

    return nodePropertiesById[focusedNodeId] ?? [];
  }, [focusedNodeId, nodePropertiesById]);

  const updateFocusedNodeProperties = useCallback((properties: EditableProperty[]) => {
    if (!focusedNodeId) {
      return;
    }

    setEditorPropertiesById((currentPropertiesById) => ({
      ...currentPropertiesById,
      [focusedNodeId]: properties,
    }));
    pendingPropertyEditRef.current = {nodeId: focusedNodeId, properties};
    schedulePropertyEditFlush();
  }, [focusedNodeId, schedulePropertyEditFlush]);

  return {
    workspace,
    activeProjectId: resolvedProjectId,
    activeChapterId: resolvedChapterId,
    nodes,
    edges,
    lanes,
    focusedNodeId,
    focusedNodeProperties,
    nodePropertiesById,
    editingNodeId,
    draftLabel,
    openNodeMenuId,
    connectingSourceNodeId,
    updateFocusedNodeProperties,
    setFocusedNodeId,
    setDraftLabel,
    setOpenNodeMenuId,
    replaceGraphModel,
    readGraphEvents,
    replaceGraphEvents,
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
