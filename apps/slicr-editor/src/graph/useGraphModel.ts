import type {EditableProperty} from '@slicr/react-ui';
import type {EdgeInput, LaneInput} from 'layout-lib';
import {useCallback, useEffect, useMemo, useRef, useState} from 'react';

import type {NodePropertyExampleValues, NodePropertySchema} from '@slicr/core/events';
import type {WorkspaceProjection} from '@slicr/core/workspaceProjector';
import {loadGraphApplication} from '../application/graphApplicationLoader';
import type {EditorCommand, EditorScope, EditorSnapshot, ProductionEditorPort} from '../application/productionEditorPort';
import type {createGraphApplication} from '../application/createGraphApplication';
import {getLaneOrder, getSuccessorNodeType} from './graphUtils';
import {deriveNodePropertyExampleValues, deriveNodePropertySchema, mergeNodePropertyEditorProperties} from './propertyEventMapping';

type GraphApplication = Awaited<ReturnType<typeof createGraphApplication>> & {editorPort: ProductionEditorPort};
import type {AddDirection, GraphNode, NodeType} from './types';

export type StoredGraphModel = {
  nodes: GraphNode[];
  edges: EdgeInput[];
  lanes: LaneInput[];
  nodeSchemas?: Record<string, NodePropertySchema[]>;
  nodeExampleValues?: Record<string, NodePropertyExampleValues[]>;
};

const LAST_OK_STORAGE_KEY = 'slicr-dcb.lastOkGraphModel.v1';
const emptyGraphModel: StoredGraphModel = {nodes: [], edges: [], lanes: []};
const emptyWorkspace: WorkspaceProjection = {projects: [], chaptersByProjectId: {}};

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

type GraphFocusState = {
  nodeId: string | null;
  editorFocusedPropertyId: string | null;
  hoveredPropertyId: string | null;
};

export function useGraphModel(scope: {activeProjectId?: string | null; activeChapterId?: string | null} = {}) {
  const skipBlurSaveRef = useRef(false);
  const cancelEditRef = useRef(false);
  const applicationRef = useRef<GraphApplication | null>(null);
  const editorPortRef = useRef<ProductionEditorPort | null>(null);
  const snapshotRef = useRef<EditorSnapshot | null>(null);
  const workspaceSubscriptionRef = useRef<{unsubscribe(): void} | null>(null);
  const portSubscriptionRef = useRef<{unsubscribe(): void} | null>(null);
  const propertyDebounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const pendingPropertyEditRef = useRef<{
    nodeId: string;
    properties: EditableProperty[];
    scope: EditorScope;
    baseRevision: string;
    port: ProductionEditorPort;
  } | null>(null);

  const [workspace, setWorkspace] = useState<WorkspaceProjection>(emptyWorkspace);
  const [resolvedProjectId, setResolvedProjectId] = useState('');
  const [resolvedChapterId, setResolvedChapterId] = useState('');
  const [nodes, setNodes] = useState<GraphNode[]>([]);
  const [edges, setEdges] = useState<EdgeInput[]>([]);
  const [lanes, setLanes] = useState<LaneInput[]>([]);
  const [nodeSchemas, setNodeSchemas] = useState<Record<string, NodePropertySchema[]>>({});
  const [nodeExampleValues, setNodeExampleValues] = useState<Record<string, NodePropertyExampleValues[]>>({});
  const [editorPropertiesById, setEditorPropertiesById] = useState<Record<string, EditableProperty[]>>({});
  const [focus, setFocus] = useState<GraphFocusState>({
    nodeId: null,
    editorFocusedPropertyId: null,
    hoveredPropertyId: null,
  });
  const focusedNodeId = focus.nodeId;
  const highlightedPropertyId = focus.hoveredPropertyId ?? focus.editorFocusedPropertyId;
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
    const nextWorkspace = applicationRef.current?.workspace.getWorkspaceSnapshot() ?? emptyWorkspace;
    const nextScope = snapshotRef.current?.scope ?? {projectId: '', chapterId: ''};
    setWorkspace(nextWorkspace);
    setResolvedProjectId(nextScope.projectId);
    setResolvedChapterId(nextScope.chapterId);
  }, []);

  const flushPendingPropertyEdit = useCallback(async () => {
    const pendingEdit = pendingPropertyEditRef.current;
    if (!pendingEdit) {
      return;
    }

    pendingPropertyEditRef.current = null;
    if (propertyDebounceRef.current) {
      clearTimeout(propertyDebounceRef.current);
      propertyDebounceRef.current = null;
    }

    const schema = deriveNodePropertySchema(pendingEdit.properties);
    const exampleValues = deriveNodePropertyExampleValues(pendingEdit.properties);
    await pendingEdit.port.execute({
      scope: pendingEdit.scope,
      baseRevision: pendingEdit.baseRevision,
      type: 'ChangeNodeProperties',
      data: {nodeId: pendingEdit.nodeId, schema, exampleValues},
    });
    setFocus((currentFocus) => currentFocus);
  }, []);

  const schedulePropertyEditFlush = useCallback(() => {
    if (propertyDebounceRef.current) {
      clearTimeout(propertyDebounceRef.current);
    }
    propertyDebounceRef.current = setTimeout(() => {
      void flushPendingPropertyEdit();
    }, 1000);
  }, [flushPendingPropertyEdit]);

  const setFocusedNodeId = useCallback(
    (nodeId: string | null) => {
      if (pendingPropertyEditRef.current && pendingPropertyEditRef.current.nodeId !== nodeId) {
        void flushPendingPropertyEdit();
      }
      setFocus({
        nodeId,
        editorFocusedPropertyId: null,
        hoveredPropertyId: null,
      });
    },
    [flushPendingPropertyEdit],
  );

  const setEditorFocusedPropertyId = useCallback((propertyId: string | null) => {
    setFocus((currentFocus) => ({...currentFocus, editorFocusedPropertyId: propertyId}));
  }, []);

  const setHoveredPropertyId = useCallback((propertyId: string | null) => {
    setFocus((currentFocus) => ({...currentFocus, hoveredPropertyId: propertyId}));
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

  const resetProjectionSubscriptions = useCallback(() => {
    workspaceSubscriptionRef.current?.unsubscribe();
    workspaceSubscriptionRef.current = null;
    portSubscriptionRef.current?.unsubscribe();
    portSubscriptionRef.current = null;
    snapshotRef.current = null;
    editorPortRef.current = null;
  }, []);

  const applySnapshot = useCallback(
    (snapshot: EditorSnapshot) => {
      snapshotRef.current = snapshot;
      applyGraphModel({
        nodes: [...snapshot.nodes],
        edges: [...snapshot.edges],
        lanes: [...snapshot.lanes],
        nodeSchemas: snapshot.nodeSchemas,
        nodeExampleValues: snapshot.nodeExampleValues,
      });
      setResolvedProjectId(snapshot.scope.projectId);
      setResolvedChapterId(snapshot.scope.chapterId);
    },
    [applyGraphModel],
  );

  const execute = useCallback((type: string, data: EditorCommand['data'], basis = snapshotRef.current) => {
    if (!basis || !editorPortRef.current) return undefined;
    return editorPortRef.current.execute({scope: basis.scope, baseRevision: basis.revision, type, data});
  }, []);

  useEffect(() => {
    let cancelled = false;

    const loadModel = async () => {
      resetProjectionSubscriptions();
      const requestedScope = {
        projectId: scope.activeProjectId ?? undefined,
        chapterId: scope.activeChapterId ?? undefined,
      };
      const application = await loadGraphApplication(requestedScope);
      await application.graph.setScope(requestedScope);
      if (cancelled) {
        return;
      }

      const graphView = application.graph;
      const editorPort = application.editorPort;
      const initialSnapshot = await editorPort.getSnapshot(graphView.getScope());
      if (cancelled) return;
      editorPortRef.current = editorPort;
      applicationRef.current = application;
      workspaceSubscriptionRef.current = application.workspace.subscribeToWorkspace(setWorkspace);
      applySnapshot(initialSnapshot);
      portSubscriptionRef.current = editorPort.subscribe(initialSnapshot.scope, applySnapshot);
      syncWorkspaceState();
      setFocusedNodeId(initialSnapshot.nodes[0]?.id ?? null);
    };

    void loadModel();
    return () => {
      cancelled = true;
      resetProjectionSubscriptions();
    };
  }, [applySnapshot, resetProjectionSubscriptions, scope.activeChapterId, scope.activeProjectId, setFocusedNodeId, syncWorkspaceState]);

  const replaceGraphModel = useCallback(
    (graphModel: StoredGraphModel) => {
      applyGraphModel(graphModel);
      setFocusedNodeId(graphModel.nodes[0]?.id ?? null);
      resetTransientState();
    },
    [applyGraphModel, resetTransientState, setFocusedNodeId],
  );

  const reload = useCallback(
    async (options: {preserveScope?: boolean} = {}) => {
      await flushPendingPropertyEdit();
      const currentScope = snapshotRef.current?.scope;
      const requestedScope =
        options.preserveScope && currentScope
          ? currentScope
          : {
              projectId: scope.activeProjectId ?? undefined,
              chapterId: scope.activeChapterId ?? undefined,
            };
      resetProjectionSubscriptions();
      const application = await loadGraphApplication(requestedScope);
      await application.graph.setScope(requestedScope);
      const graphView = application.graph;
      const editorPort = application.editorPort;
      const reloadedSnapshot = await editorPort.getSnapshot(graphView.getScope());
      editorPortRef.current = editorPort;
      applicationRef.current = application;
      workspaceSubscriptionRef.current = application.workspace.subscribeToWorkspace(setWorkspace);
      applySnapshot(reloadedSnapshot);
      portSubscriptionRef.current = editorPort.subscribe(reloadedSnapshot.scope, applySnapshot);
      syncWorkspaceState();
      setFocusedNodeId(reloadedSnapshot.nodes[0]?.id ?? null);
      resetTransientState();
    },
    [
      applySnapshot,
      flushPendingPropertyEdit,
      resetProjectionSubscriptions,
      resetTransientState,
      scope.activeChapterId,
      scope.activeProjectId,
      setFocusedNodeId,
      syncWorkspaceState,
    ],
  );

  const revertToLastOkGraphModel = useCallback(() => {
    replaceGraphModel(readLastOkGraphModel());
  }, [replaceGraphModel]);

  const addNewSlice = useCallback(() => {
    void (async () => {
      const basis = snapshotRef.current;
      const result = await execute('AddNode', {}, basis);
      const id = result?.createdIds[0];
      if (!id) {
        return;
      }
      const newNode = snapshotRef.current?.nodes.find((node) => node.id === id);
      const label = newNode?.label ?? `Node ${(basis?.nodes.length ?? 0) + 1}`;
      setFocusedNodeId(id);
      setOpenNodeMenuId(null);
      setConnectingSourceNodeId(null);
      skipBlurSaveRef.current = false;
      cancelEditRef.current = false;
      setEditingNodeId(id);
      setDraftLabel(label);
      setOriginalLabel(label);
    })();
  }, [execute, setFocusedNodeId]);

  const addProject = useCallback(
    async (name: string) => {
      const result = await execute('AddProject', {name});
      if (!result?.createdIds[0]) {
        return;
      }

      setOpenNodeMenuId(null);
      setConnectingSourceNodeId(null);
      skipBlurSaveRef.current = false;
      cancelEditRef.current = false;
      setEditingNodeId(null);
      setDraftLabel('');
      setOriginalLabel('');
    },
    [execute],
  );

  const renameProject = useCallback(
    async (projectId: string, name: string) => {
      await execute('RenameProject', {projectId, name});
    },
    [execute],
  );

  const addChapter = useCallback(
    async (title: string) => {
      const result = await execute('AddChapter', {title});
      if (!result?.createdIds[0]) {
        return undefined;
      }

      setOpenNodeMenuId(null);
      setConnectingSourceNodeId(null);
      skipBlurSaveRef.current = false;
      cancelEditRef.current = false;
      setEditingNodeId(null);
      setDraftLabel('');
      setOriginalLabel('');

      return result.createdIds[0];
    },
    [execute],
  );

  const startConnectingFromNode = useCallback(
    (nodeId: string) => {
      setFocusedNodeId(nodeId);
      setOpenNodeMenuId(null);
      setConnectingSourceNodeId(nodeId);
    },
    [setFocusedNodeId],
  );

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
        await execute('ConnectNodes', {sourceNodeId, targetNodeId, role});
        setConnectingSourceNodeId(null);
        setFocusedNodeId(targetNodeId);
        setOpenNodeMenuId(null);
      })();
    },
    [edges, execute, setFocusedNodeId],
  );

  const deleteConnection = useCallback(
    (edgeId: string) => {
      void (async () => {
        await execute('DisconnectNodes', {edgeId});
      })();
    },
    [execute],
  );

  const addConnectedNode = useCallback(
    (sourceNode: GraphNode, direction: AddDirection, typeOverride?: NodeType) => {
      const sourceLaneOrder = getLaneOrder(lanes, sourceNode.laneId);
      const targetLaneOrder = direction === 'top' ? sourceLaneOrder - 1 : direction === 'bottom' ? sourceLaneOrder + 1 : sourceLaneOrder;
      const targetType = typeOverride ?? getSuccessorNodeType(sourceNode.type, direction);
      const label = `Node ${nodes.length + 1}`;

      void (async () => {
        const result = await execute('AddConnectedNode', {
          sourceNodeId: sourceNode.id,
          nodeType: targetType,
          laneId: targetLaneOrder,
          label,
        });
        const id =
          result?.createdIds.find((createdId) => snapshotRef.current?.nodes.some((node) => node.id === createdId)) ?? result?.createdIds[0];
        if (!id) {
          return;
        }
        setFocusedNodeId(id);
        setConnectingSourceNodeId(null);
        skipBlurSaveRef.current = false;
        cancelEditRef.current = false;
        setEditingNodeId(id);
        setDraftLabel(label);
        setOriginalLabel(label);
      })();
    },
    [execute, lanes, nodes, setFocusedNodeId],
  );

  const deleteNode = useCallback(
    (nodeId: string) => {
      const predecessorNodeId = edges.find((edge) => edge.targetId === nodeId)?.sourceId ?? null;

      void (async () => {
        await execute('DeleteNode', {nodeId});
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
    [connectingSourceNodeId, edges, editingNodeId, execute, focusedNodeId, openNodeMenuId, setFocusedNodeId],
  );

  const setNodeType = useCallback(
    (nodeId: string, type: NodeType) => {
      void (async () => {
        await execute('ChangeNodeType', {nodeId, newType: type});
        setOpenNodeMenuId(null);
      })();
    },
    [execute],
  );

  const startEditingNode = useCallback(
    (node: GraphNode) => {
      skipBlurSaveRef.current = false;
      cancelEditRef.current = false;
      setFocusedNodeId(node.id);
      setConnectingSourceNodeId(null);
      setEditingNodeId(node.id);
      setDraftLabel(node.label);
      setOriginalLabel(node.label);
    },
    [setFocusedNodeId],
  );

  const saveEditingNode = useCallback(() => {
    if (!editingNodeId || cancelEditRef.current) {
      return;
    }

    const nodeId = editingNodeId;
    const nextLabel = draftLabel.trim() || 'Untitled';
    void (async () => {
      await execute('RenameNode', {nodeId, name: nextLabel});
      cancelEditRef.current = false;
      setEditingNodeId(null);
      setDraftLabel('');
      setOriginalLabel('');
    })();
  }, [draftLabel, editingNodeId, execute]);

  const cancelEditingNode = useCallback(() => {
    cancelEditRef.current = true;
    if (editingNodeId) {
      setNodes((currentNodes) => currentNodes.map((node) => (node.id === editingNodeId ? {...node, label: originalLabel} : node)));
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
          editorPropertiesById[node.id] ?? mergeNodePropertyEditorProperties(nodeSchemas[node.id] ?? [], nodeExampleValues[node.id] ?? []),
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

  const updateFocusedNodeProperties = useCallback(
    (properties: EditableProperty[]) => {
      if (!focusedNodeId) {
        return;
      }

      setEditorPropertiesById((currentPropertiesById) => ({
        ...currentPropertiesById,
        [focusedNodeId]: properties,
      }));
      const basis = pendingPropertyEditRef.current?.nodeId === focusedNodeId ? pendingPropertyEditRef.current : snapshotRef.current;
      if (!basis || !editorPortRef.current) return;
      pendingPropertyEditRef.current = {
        nodeId: focusedNodeId,
        properties,
        scope: basis.scope,
        baseRevision: 'baseRevision' in basis ? basis.baseRevision : basis.revision,
        port: 'port' in basis ? basis.port : editorPortRef.current,
      };
      schedulePropertyEditFlush();
    },
    [focusedNodeId, schedulePropertyEditFlush],
  );

  return {
    workspace,
    activeProjectId: resolvedProjectId,
    activeChapterId: resolvedChapterId,
    nodes,
    edges,
    lanes,
    focusedNodeId,
    editorFocusedPropertyId: focus.editorFocusedPropertyId,
    hoveredPropertyId: focus.hoveredPropertyId,
    highlightedPropertyId,
    focusedNodeProperties,
    nodePropertiesById,
    editingNodeId,
    draftLabel,
    openNodeMenuId,
    connectingSourceNodeId,
    updateFocusedNodeProperties,
    setFocusedNodeId,
    setEditorFocusedPropertyId,
    setHoveredPropertyId,
    setDraftLabel,
    setOpenNodeMenuId,
    replaceGraphModel,
    reload,
    revertToLastOkGraphModel,
    addNewSlice,
    addProject,
    renameProject,
    addChapter,
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
