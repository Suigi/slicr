import type {EditableProperty} from '@slicr/react-ui';
import type {EdgeInput, LaneInput} from 'layout-lib';
import {useCallback, useEffect, useMemo, useRef, useState} from 'react';

import type {NodePropertyExampleValues, NodePropertySchema} from '@slicr/core/events';
import type {WorkspaceProjection} from '@slicr/core/workspaceProjector';
import {loadGraphApplication} from '../application/graphApplicationLoader';
import type {EditorAction, EditorScope, EditorSnapshot, ProductionEditorPort} from '../application/productionEditorPort';
import type {createGraphApplication} from '../application/createGraphApplication';
import {useProductionGraphController} from './useProductionGraphController';
import {deriveNodePropertyExampleValues, deriveNodePropertySchema, mergeNodePropertyEditorProperties} from './propertyEventMapping';

type GraphApplication = Awaited<ReturnType<typeof createGraphApplication>> & {editorPort: ProductionEditorPort};
import type {GraphNode, NodeType} from './types';

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

export function useGraphModel(scope: {activeProjectId?: string | null; activeChapterId?: string | null} = {}) {
  const applicationRef = useRef<GraphApplication | null>(null);
  const editorPortRef = useRef<ProductionEditorPort | null>(null);
  const snapshotRef = useRef<EditorSnapshot | null>(null);
  const workspaceSubscriptionRef = useRef<{unsubscribe(): void} | null>(null);
  const portSubscriptionRef = useRef<{unsubscribe(): void} | null>(null);
  const propertyDebounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const propertyFlushRef = useRef<Promise<void> | null>(null);
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
    if (propertyDebounceRef.current) {
      clearTimeout(propertyDebounceRef.current);
      propertyDebounceRef.current = null;
    }
    // A timer or focus change may already have submitted the old scope's write.
    // Do not change the graph scope until that write has settled as well.
    if (propertyFlushRef.current) {
      try {
        await propertyFlushRef.current;
      } catch {
        // Even if the submitted write failed, any newer draft still belongs to its captured scope.
      }
    }
    const pendingEdit = pendingPropertyEditRef.current;
    if (!pendingEdit) return;
    pendingPropertyEditRef.current = null;
    const schema = deriveNodePropertySchema(pendingEdit.properties);
    const exampleValues = deriveNodePropertyExampleValues(pendingEdit.properties);
    const write = pendingEdit.port
      .execute({
        scope: pendingEdit.scope,
        baseRevision: pendingEdit.baseRevision,
        type: 'ChangeNodeProperties',
        data: {nodeId: pendingEdit.nodeId, schema, exampleValues},
      })
      .then(() => {});
    propertyFlushRef.current = write;
    try {
      await write;
    } finally {
      if (propertyFlushRef.current === write) propertyFlushRef.current = null;
    }
  }, []);

  const schedulePropertyEditFlush = useCallback(() => {
    if (propertyDebounceRef.current) {
      clearTimeout(propertyDebounceRef.current);
    }
    propertyDebounceRef.current = setTimeout(() => {
      void flushPendingPropertyEdit();
    }, 1000);
  }, [flushPendingPropertyEdit]);

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

  const execute = useCallback((action: EditorAction, basis = snapshotRef.current) => {
    if (!basis || !editorPortRef.current) return undefined;
    return editorPortRef.current.execute({...action, scope: basis.scope, baseRevision: basis.revision});
  }, []);

  const controller = useProductionGraphController({
    nodes,
    edges,
    lanes,
    chapterId: resolvedChapterId,
    execute,
    cancelOnBodyBlur: true,
    onFocusChange: (id) => {
      if (pendingPropertyEditRef.current && pendingPropertyEditRef.current.nodeId !== id) void flushPendingPropertyEdit();
    },
    onCancelEdit: (id, label) => setNodes((current) => current.map((node) => (node.id === id ? {...node, label} : node))),
  });
  const {
    focusedNodeId,
    editingNodeId,
    draftLabel,
    openNodeMenuId,
    connectingSourceNodeId,
    setFocusedNodeId,
    setEditorFocusedPropertyId,
    setHoveredPropertyId,
    setDraftLabel,
    setOpenNodeMenuId,
    resetTransientState,
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
  } = controller;

  useEffect(() => {
    let cancelled = false;

    const loadModel = async () => {
      resetProjectionSubscriptions();
      resetTransientState();
      setFocusedNodeId(null);
      try {
        await flushPendingPropertyEdit();
      } catch {
        // The old scope's property write has settled; loading the requested scope must still proceed.
      }
      if (cancelled) return;
      const requestedScope = {
        projectId: scope.activeProjectId ?? undefined,
        chapterId: scope.activeChapterId ?? undefined,
      };
      const application = await loadGraphApplication(requestedScope);
      if (cancelled) return;
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
  }, [
    applySnapshot,
    flushPendingPropertyEdit,
    resetProjectionSubscriptions,
    resetTransientState,
    scope.activeChapterId,
    scope.activeProjectId,
    setFocusedNodeId,
    syncWorkspaceState,
  ]);

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

  const addProject = useCallback(
    async (name: string) => {
      const result = await execute({type: 'AddProject', data: {name}});
      if (result?.createdIds[0]) resetTransientState();
    },
    [execute, resetTransientState],
  );

  const renameProject = useCallback(
    async (projectId: string, name: string) => {
      await execute({type: 'RenameProject', data: {projectId, name}});
    },
    [execute],
  );

  const addChapter = useCallback(
    async (title: string) => {
      const result = await execute({type: 'AddChapter', data: {title}});
      if (result?.createdIds[0]) resetTransientState();
      return result?.createdIds[0];
    },
    [execute, resetTransientState],
  );

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
    editorFocusedPropertyId: controller.editorFocusedPropertyId,
    hoveredPropertyId: controller.hoveredPropertyId,
    highlightedPropertyId: controller.highlightedPropertyId,
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
    onNodeClick: controller.onNodeClick,
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
