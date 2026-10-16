import {useEffect, useMemo, useRef, useState} from 'react';
import {type EditableProperty, type InfiniteCanvasHandle} from '@slicr/react-ui';
import {compactLayout} from 'layout-lib';
import {ProductionEditorShell} from './components/ProductionEditorShell';
import {ProductionGraphEditor} from './components/ProductionGraphEditor';
import {NODE_HEIGHT, NODE_WIDTH, laneIdForOrder} from './graph/constants';
import {getArrowRenderPoints} from './graph/graphUtils';
import {useGraphKeyboardInteractions} from './graph/useGraphKeyboardInteractions';
import {deriveNodePropertyExampleValues, deriveNodePropertySchema, mergeNodePropertyEditorProperties} from './graph/propertyEventMapping';
import type {GraphNode, NodeType, RenderNode} from './graph/types';
import type {NodePropertySchema, NodePropertyExampleValues} from '@slicr/core/events';
import {measureNodeDimensions, type NodeDimensions} from './nodeMeasurement';
import {createProjectProductionEditorPort, ProjectCommandError} from './application/projectProductionEditorPort';
import type {EditorSnapshot} from './application/productionEditorPort';

type Project = {id: string; name: string};
type Chapter = {id: string; title: string};
type Model = {
  projectDirectory: string;
  storeDirectory: string;
  revision: string;
  projects: Project[];
  chaptersByProjectId: Record<string, Chapter[]>;
};
type Projection = {
  revision: string;
  projectId: string;
  chapterId: string | null;
  nodes: {id: string; label: string; type: NodeType; laneId: number; chapterId?: string | null}[];
  edges: {sourceNodeId: string; targetNodeId: string; role: 'flow' | 'back-reference'}[];
  nodeSchemas: Record<string, NodePropertySchema[]>;
  nodeExampleValues: Record<string, NodePropertyExampleValues[]>;
};

const projectEditorPort = createProjectProductionEditorPort();

function toProjection(snapshot: EditorSnapshot): Projection {
  return {
    revision: snapshot.revision,
    projectId: snapshot.scope.projectId,
    chapterId: snapshot.scope.chapterId,
    nodes: snapshot.nodes.map((node) => ({
      id: node.id,
      label: node.label,
      type: node.type,
      laneId: snapshot.lanes.find((lane) => lane.id === node.laneId)?.order ?? 0,
    })),
    edges: snapshot.edges.map((edge) => ({sourceNodeId: edge.sourceId, targetNodeId: edge.targetId, role: edge.role ?? 'flow'})),
    nodeSchemas: snapshot.nodeSchemas,
    nodeExampleValues: snapshot.nodeExampleValues,
  };
}

async function getProjectSnapshot(projectId: string, chapterId: string): Promise<Projection> {
  return toProjection(await projectEditorPort.getSnapshot({projectId, chapterId}));
}

async function readApi<T>(url: string, signal: AbortSignal): Promise<T> {
  const response = await fetch(url, {signal, headers: {accept: 'application/json'}});
  const body = await response.json();
  if (!response.ok) throw new Error(body.error ?? `Request failed (${response.status})`);
  return body as T;
}

async function writeApi(command: {projectId: string; baseRevision: string; type: string; data: Record<string, unknown>}) {
  const result = await projectEditorPort.execute({
    scope: {projectId: command.projectId, chapterId: String(command.data.chapterId ?? '')},
    baseRevision: command.baseRevision,
    type: command.type,
    data: command.data,
  });
  return {revision: result.revision, generatedIds: [...result.createdIds]};
}

/** Served entry point only: deliberately never imports App, useGraphModel, or any browser event store. */
export function ReadOnlyProjectApp() {
  const canvasRef = useRef<InfiniteCanvasHandle>(null);
  const measureRef = useRef<HTMLDivElement>(null);
  const [model, setModel] = useState<Model | null>(null);
  const [projectId, setProjectId] = useState('');
  const [chapterId, setChapterId] = useState('');
  const [projection, setProjection] = useState<Projection | null>(null);
  const [error, setError] = useState('');
  const [refreshError, setRefreshError] = useState('');
  const [scopeSwitchNotice, setScopeSwitchNotice] = useState('');
  const readGeneration = useRef(0);
  const scopeIdentity = `${projectId}\u0000${chapterId}`;
  const currentScopeIdentity = useRef(scopeIdentity);
  currentScopeIdentity.current = scopeIdentity;
  const [measurements, setMeasurements] = useState<Record<string, NodeDimensions>>({});
  const [editingNodeId, setEditingNodeId] = useState<string | null>(null);
  const [draftLabel, setDraftLabel] = useState('');
  const [focusedNodeId, setFocusedNodeId] = useState<string | null>(null);
  const [menuNodeId, setMenuNodeId] = useState<string | null>(null);
  const [connectingNodeId, setConnectingNodeId] = useState<string | null>(null);
  const [isSidebarOpen, setIsSidebarOpen] = useState(true);
  const [focusedPropertyId, setFocusedPropertyId] = useState<string | null>(null);
  const [hoveredPropertyId, setHoveredPropertyId] = useState<string | null>(null);
  const [propertyDrafts, setPropertyDrafts] = useState<Record<string, EditableProperty[]>>({});
  const [pendingScopeSwitch, setPendingScopeSwitch] = useState<{projectId: string; chapterId: string; label: string} | null>(null);
  const savingLabelRef = useRef(false);
  const cancelLabelRef = useRef(false);
  const propertySaveTimer = useRef<number | null>(null);
  const pendingPropertySaves = useRef(
    new Map<
      string,
      {
        projectId: string;
        scopeIdentity: string;
        nodeId: string;
        schema: NodePropertySchema[];
        exampleValues: NodePropertyExampleValues[];
        baseRevision: string;
      }
    >(),
  );
  const propertySaveInFlight = useRef(false);
  const propertySaveFailed = useRef(false);

  useEffect(() => {
    const controller = new AbortController();
    readApi<Model>('/api/model', controller.signal)
      .then((next) => {
        setModel(next);
        const initialProjectId = next.projects[0]?.id ?? '';
        setProjectId(initialProjectId);
        setChapterId(next.chaptersByProjectId[initialProjectId]?.[0]?.id ?? '');
      })
      .catch((reason: unknown) => {
        if (!controller.signal.aborted) setError(`Could not load project model: ${String(reason)}`);
      });
    return () => controller.abort();
  }, []);

  useEffect(() => {
    if (!projectId) return;
    const requestScope = `${projectId}\u0000${chapterId}`;
    const subscription = projectEditorPort.subscribe({projectId, chapterId}, (snapshot) => {
      if (currentScopeIdentity.current !== requestScope) return;
      setProjection((current) => (current?.revision === snapshot.revision ? current : toProjection(snapshot)));
      setRefreshError('');
      setError((current) => (current.startsWith('Could not load project') ? '' : current));
    });
    return () => subscription.unsubscribe();
  }, [projectId, chapterId]);

  const refreshProjection = async () => {
    if (!projectId) return;
    const generation = ++readGeneration.current;
    const requestScope = scopeIdentity;
    const controller = new AbortController();
    const [next, nextModel] = await Promise.all([
      getProjectSnapshot(projectId, chapterId),
      readApi<Model>('/api/model', controller.signal),
    ]);
    if (generation !== readGeneration.current || currentScopeIdentity.current !== requestScope) return;
    setProjection(next);
    setModel(nextModel);
  };
  const drainPropertySaves = async () => {
    if (propertySaveInFlight.current) return;
    propertySaveInFlight.current = true;
    let resumeQueue = false;
    try {
      while (pendingPropertySaves.current.size > 0) {
        const [key, pending] = pendingPropertySaves.current.entries().next().value as [
          string,
          {
            projectId: string;
            scopeIdentity: string;
            nodeId: string;
            schema: NodePropertySchema[];
            exampleValues: NodePropertyExampleValues[];
            baseRevision: string;
          },
        ];
        pendingPropertySaves.current.delete(key);
        try {
          const result = await writeApi({
            projectId: pending.projectId,
            baseRevision: pending.baseRevision,
            type: 'ChangeNodeProperties',
            data: {nodeId: pending.nodeId, schema: pending.schema, exampleValues: pending.exampleValues},
          });
          const newer = pendingPropertySaves.current.get(key);
          if (newer && newer.baseRevision === pending.baseRevision) newer.baseRevision = result.revision;
          propertySaveFailed.current = false;
          if (pending.scopeIdentity === currentScopeIdentity.current) {
            try {
              await refreshProjection();
              setRefreshError('');
            } catch (reason) {
              setRefreshError(`Property edit saved, but project refresh failed: ${String(reason)}`);
            }
            if (!pendingPropertySaves.current.has(key)) {
              setPropertyDrafts((current) => {
                const next = {...current};
                delete next[key];
                return next;
              });
            }
          }
        } catch (reason) {
          propertySaveFailed.current = true;
          if (pending.scopeIdentity === currentScopeIdentity.current) {
            const conflict =
              reason instanceof ProjectCommandError && ['BASE_REVISION_MISMATCH', 'APPEND_CONDITION_FAILED'].includes(reason.code ?? '');
            const newerPending = pendingPropertySaves.current.has(key);
            resumeQueue = newerPending && !conflict;
            if (conflict) {
              pendingPropertySaves.current.delete(key);
              setPropertyDrafts((current) => {
                const next = {...current};
                delete next[key];
                return next;
              });
              try {
                await refreshProjection();
              } catch (refreshReason) {
                setRefreshError(`Could not reload the current project after the conflict: ${String(refreshReason)}`);
              }
              setError(
                'Property edit was not saved because the project changed. The draft was discarded; redo the edit on the current version.',
              );
            } else {
              setError(`Could not save property edits; your draft is retained. Retry the save or keep editing. ${String(reason)}`);
              if (!newerPending) pendingPropertySaves.current.set(key, pending);
            }
            break;
          }
        }
      }
    } finally {
      propertySaveInFlight.current = false;
      if (resumeQueue && propertySaveTimer.current === null) {
        propertySaveTimer.current = window.setTimeout(() => {
          propertySaveTimer.current = null;
          void drainPropertySaves();
        }, 300);
      }
    }
  };

  const saveLabel = async () => {
    if (!editingNodeId || !projectId || savingLabelRef.current || cancelLabelRef.current) return;
    const nodeId = editingNodeId;
    const requestScope = scopeIdentity;
    const label = draftLabel.trim() || 'Untitled';
    savingLabelRef.current = true;
    try {
      if (!projection) throw new Error('The latest project revision is not loaded.');
      await writeApi({projectId, baseRevision: projection.revision, type: 'RenameNode', data: {nodeId, name: label}});
      if (currentScopeIdentity.current !== requestScope) return;
      setEditingNodeId(null);
      setDraftLabel('');
      setError('');
      try {
        await refreshProjection();
        if (currentScopeIdentity.current === requestScope) setRefreshError('');
      } catch (reason) {
        if (currentScopeIdentity.current === requestScope) setRefreshError(`Edit saved, but project refresh failed: ${String(reason)}`);
      }
    } catch (reason) {
      if (currentScopeIdentity.current === requestScope) setError(`Could not save edit: ${String(reason)}`);
    } finally {
      savingLabelRef.current = false;
    }
  };

  const execute = async (type: string, data: Record<string, unknown>, selectedProjectId = projectId) => {
    const requestScope = scopeIdentity;
    try {
      const baseRevision = projection?.revision ?? model?.revision;
      if (!baseRevision) throw new Error('The latest project revision is not loaded.');
      if (type !== 'AddProject' && !selectedProjectId) throw new Error('Select a project before editing it.');
      const result = await writeApi({projectId: selectedProjectId, baseRevision, type, data});
      if (currentScopeIdentity.current !== requestScope) return result;
      setError('');
      if (type === 'AddProject') {
        setProjection(null);
        setFocusedNodeId(null);
        setFocusedPropertyId(null);
        setHoveredPropertyId(null);
        setEditingNodeId(null);
        setMenuNodeId(null);
        setConnectingNodeId(null);
        try {
          const updatedModel = await readApi<Model>('/api/model', new AbortController().signal);
          if (currentScopeIdentity.current !== requestScope) return result;
          const createdProjectId = result.generatedIds?.[0];
          setModel(updatedModel);
          if (createdProjectId && updatedModel.projects.some((project) => project.id === createdProjectId)) {
            setProjectId(createdProjectId);
            setChapterId(updatedModel.chaptersByProjectId[createdProjectId]?.[0]?.id ?? '');
          }
        } catch (reason) {
          if (currentScopeIdentity.current === requestScope)
            setRefreshError(`Project saved, but the project list could not be refreshed. Do not create it again. ${String(reason)}`);
        }
      } else {
        if (type === 'AddChapter') {
          setProjection(null);
          setFocusedNodeId(null);
          setFocusedPropertyId(null);
          setHoveredPropertyId(null);
          setEditingNodeId(null);
          setMenuNodeId(null);
          setConnectingNodeId(null);
        }
        try {
          await refreshProjection();
          if (type === 'AddChapter') {
            const createdChapterId = result.generatedIds?.[0];
            if (createdChapterId) setChapterId(createdChapterId);
          }
        } catch (reason) {
          if (currentScopeIdentity.current === requestScope)
            setRefreshError(
              `${type === 'AddChapter' ? 'Chapter' : type} saved, but project refresh failed. Do not repeat the create command. ${String(reason)}`,
            );
        }
      }
      if (currentScopeIdentity.current === requestScope) setRefreshError('');
      return result;
    } catch (reason) {
      if (currentScopeIdentity.current === requestScope) setError(`Could not save ${type}: ${String(reason)}`);
      return null;
    }
  };

  const hasUnresolvedPropertyDrafts = () => pendingPropertySaves.current.size > 0 || Object.keys(propertyDrafts).length > 0;
  const switchScope = (nextProjectId: string, nextChapterId: string) => {
    currentScopeIdentity.current = `${nextProjectId}\u0000${nextChapterId}`;
    readGeneration.current++;
    setProjection(null);
    if (propertySaveTimer.current !== null) window.clearTimeout(propertySaveTimer.current);
    propertySaveTimer.current = null;
    setFocusedPropertyId(null);
    setHoveredPropertyId(null);
    setFocusedNodeId(null);
    setEditingNodeId(null);
    setDraftLabel('');
    setMenuNodeId(null);
    setConnectingNodeId(null);
    setError('');
    setRefreshError('');
    setProjectId(nextProjectId);
    setChapterId(nextChapterId);
  };
  const resolvePendingScopeSwitch = async (mode: 'wait' | 'discard') => {
    if (!pendingScopeSwitch) return;
    const target = pendingScopeSwitch;
    if (mode === 'wait') {
      if (propertySaveTimer.current !== null) window.clearTimeout(propertySaveTimer.current);
      propertySaveTimer.current = null;
      await drainPropertySaves();
      while (propertySaveInFlight.current) await new Promise((resolve) => window.setTimeout(resolve, 10));
      if (pendingPropertySaves.current.size > 0 || propertySaveFailed.current) {
        setError('Property edits could not be flushed. Resolve the save or conflict before switching; the current scope remains open.');
        setPendingScopeSwitch(null);
        return;
      }
      setPendingScopeSwitch(null);
      switchScope(target.projectId, target.chapterId);
      return;
    }
    const submitted = propertySaveInFlight.current;
    if (propertySaveTimer.current !== null) window.clearTimeout(propertySaveTimer.current);
    propertySaveTimer.current = null;
    pendingPropertySaves.current.clear();
    setPropertyDrafts({});
    let notice = 'Pending property drafts were discarded.';
    if (submitted) {
      notice =
        'Unsent property drafts were discarded. A submitted command could not be canceled; its outcome was resolved before switching.';
      while (propertySaveInFlight.current) await new Promise((resolve) => window.setTimeout(resolve, 10));
    }
    setPendingScopeSwitch(null);
    switchScope(target.projectId, target.chapterId);
    setScopeSwitchNotice(notice);
  };

  const chapters = model?.chaptersByProjectId[projectId] ?? [];
  const graph = useMemo(() => {
    const nodes: GraphNode[] = (projection?.nodes ?? []).map((node) => ({
      id: node.id,
      label: node.label,
      type: node.type,
      laneId: laneIdForOrder(node.laneId),
      width: NODE_WIDTH,
      height: NODE_HEIGHT,
    }));
    const edges = (projection?.edges ?? []).map((edge) => ({
      id: `edge-${edge.sourceNodeId}-${edge.targetNodeId}`,
      sourceId: edge.sourceNodeId,
      targetId: edge.targetNodeId,
      role: edge.role,
    }));
    const lanes = [...new Set(nodes.map((node) => Number(node.laneId.slice(5))))].map((order) => ({id: laneIdForOrder(order), order}));
    return {nodes, edges, lanes};
  }, [projection]);
  const propertiesById = useMemo(
    () =>
      Object.fromEntries(
        graph.nodes.map((node) => [
          node.id,
          mergeNodePropertyEditorProperties(projection?.nodeSchemas[node.id] ?? [], projection?.nodeExampleValues[node.id] ?? []),
        ]),
      ),
    [graph.nodes, projection],
  );
  const layout = useMemo(
    () =>
      compactLayout({
        nodes: graph.nodes.map((node) => ({...node, height: Math.max(NODE_HEIGHT, measurements[node.id]?.height ?? NODE_HEIGHT)})),
        edges: graph.edges,
        lanes: graph.lanes,
        defaults: {nodeWidth: NODE_WIDTH, nodeHeight: NODE_HEIGHT},
        spacing: {laneMargin: 0, laneGap: 100, minTargetShift: 20, minNodeGap: 40},
      }),
    [graph, measurements],
  );
  const renderedNodes: RenderNode[] = layout.ok
    ? layout.result.nodes.flatMap((position) => {
        const node = graph.nodes.find((item) => item.id === position.id);
        return node ? [{...node, ...position}] : [];
      })
    : [];
  useEffect(() => {
    if (focusedNodeId && !graph.nodes.some((node) => node.id === focusedNodeId)) setFocusedNodeId(null);
  }, [focusedNodeId, graph.nodes]);
  useEffect(() => {
    if (projection?.nodes.length) setFocusedNodeId((current) => current ?? projection.nodes[0].id);
  }, [projection]);
  useEffect(() => {
    const next = measureNodeDimensions(measureRef.current ?? document);
    setMeasurements((current) => (JSON.stringify(current) === JSON.stringify(next) ? current : next));
  }, [projection, propertiesById]);
  useEffect(() => {
    canvasRef.current?.setCamera({x: 100, y: 100, zoom: 1});
  }, []);

  useGraphKeyboardInteractions({
    nodes: graph.nodes,
    edges: graph.edges,
    focusedNodeId,
    connectingNodeId,
    onCancelConnection: () => {
      setConnectingNodeId(null);
      setError('');
    },
    onStartConnection: (nodeId) => {
      setConnectingNodeId(nodeId);
    },
    onAddConnectedNode: (node, direction, type) => {
      const chapter = chapterId || projection?.nodes.find((item) => item.id === node.id)?.chapterId;
      if (chapter)
        void execute('AddConnectedNode', {chapterId: chapter, sourceNodeId: node.id, label: 'New Node', direction, nodeType: type}).then(
          (result) => {
            const id = result?.generatedIds?.[0];
            if (id && currentScopeIdentity.current === scopeIdentity) {
              setFocusedNodeId(id);
              setEditingNodeId(id);
              setDraftLabel('New Node');
            }
          },
        );
    },
    onStartEditing: (node) => {
      cancelLabelRef.current = false;
      setEditingNodeId(node.id);
      setDraftLabel(node.label);
    },
    onDeleteNode: (nodeId) => {
      void execute('DeleteNode', {nodeId});
      setFocusedNodeId(null);
    },
    onFocusNode: (nodeId) => {
      setFocusedNodeId(nodeId);
      setFocusedPropertyId(null);
      setHoveredPropertyId(null);
    },
    onCloseMenus: () => setMenuNodeId(null),
  });

  useEffect(() => {
    if (!chapterId && model?.chaptersByProjectId[projectId]?.length) {
      const firstChapterId = model.chaptersByProjectId[projectId][0].id;
      currentScopeIdentity.current = `${projectId}\u0000${firstChapterId}`;
      setChapterId(firstChapterId);
    }
  }, [chapterId, model, projectId]);

  useEffect(
    () => () => {
      if (propertySaveTimer.current !== null) window.clearTimeout(propertySaveTimer.current);
    },
    [],
  );

  useEffect(() => {
    if (!editingNodeId) return;
    const outsidePointer = (event: PointerEvent) => {
      if (event.target instanceof Element && event.target.closest('.node-label-input')) return;
      saveLabel();
    };
    document.addEventListener('pointerdown', outsidePointer, true);
    return () => document.removeEventListener('pointerdown', outsidePointer, true);
  }, [editingNodeId, draftLabel, projection]);

  return (
    <ProductionEditorShell
      projects={model?.projects ?? []}
      chapters={chapters}
      projectId={projectId}
      chapterId={chapterId}
      isSidebarOpen={isSidebarOpen}
      onSelectProject={(id) => {
        if (hasUnresolvedPropertyDrafts()) {
          setPendingScopeSwitch({projectId: id, chapterId: '', label: 'project'});
          return;
        }
        switchScope(id, '');
      }}
      onAddProject={(name) => void execute('AddProject', {name})}
      onRenameProject={(id, name) => void execute('RenameProject', {name}, id)}
      onSelectChapter={(id) => {
        if (hasUnresolvedPropertyDrafts()) {
          setPendingScopeSwitch({projectId, chapterId: id, label: 'chapter'});
          return;
        }
        switchScope(projectId, id);
      }}
      onCollapseSidebar={() => setIsSidebarOpen(false)}
      onExpandSidebar={() => setIsSidebarOpen(true)}
      onAddChapter={(title) => void execute('AddChapter', {title})}
      topbarActions={<strong>Project store · editing enabled</strong>}
    >
      <div className="read-only-identity" aria-label="Project store identity">
        <strong>Project-backed editor · project store</strong>
        <div>Project directory: {model?.projectDirectory ?? 'Loading…'}</div>
        <div>Store: {model?.storeDirectory ?? 'Loading…'}</div>
        <div>Revision: {projection?.revision ?? model?.revision ?? 'Loading…'}</div>
      </div>
      {error ? <p role="alert">{error}</p> : null}
      {refreshError ? <p role="alert">{refreshError}</p> : null}
      {scopeSwitchNotice ? <p role="status">{scopeSwitchNotice}</p> : null}
      {pendingScopeSwitch ? (
        <section role="dialog" aria-modal="true" aria-labelledby="scope-switch-heading">
          <h2 id="scope-switch-heading">Property edits are pending</h2>
          <p>Wait for edits to flush to the current {pendingScopeSwitch.label}, or switch and discard unsent drafts.</p>
          <button type="button" onClick={() => void resolvePendingScopeSwitch('wait')}>
            Wait for flush
          </button>
          <button type="button" onClick={() => void resolvePendingScopeSwitch('discard')}>
            Switch and discard
          </button>
          <button type="button" onClick={() => setPendingScopeSwitch(null)}>
            Stay here
          </button>
        </section>
      ) : null}
      {pendingPropertySaves.current.size > 0 ? (
        <button type="button" onClick={() => void drainPropertySaves()}>
          Retry property save
        </button>
      ) : null}
      {!model && !error && !refreshError ? <p>Loading project model…</p> : null}
      {model && !projectId ? <p>No projects in this model.</p> : null}
      {projectId && !projection && !error ? <p>Loading project projection…</p> : null}
      {projection ? (
        <>
          <button
            type="button"
            onClick={() => {
              const chapter = chapterId || chapters[0]?.id;
              if (!chapter) {
                setError('Select a chapter before adding a node.');
                return;
              }
              if (!projection) {
                setError('The latest project revision is not loaded.');
                return;
              }
              const requestScope = scopeIdentity;
              const label = `Node ${graph.nodes.length + 1}`;
              void writeApi({
                projectId,
                baseRevision: projection.revision,
                type: 'AddNode',
                data: {chapterId: chapter, nodeType: 'ui', laneId: 0, label},
              })
                .then(async (result) => {
                  if (currentScopeIdentity.current !== requestScope) return;
                  setError('');
                  try {
                    await refreshProjection();
                    const createdNodeId = result.generatedIds?.[0];
                    if (createdNodeId && currentScopeIdentity.current === requestScope) {
                      setFocusedNodeId(createdNodeId);
                      setEditingNodeId(createdNodeId);
                      setDraftLabel(label);
                    }
                    if (currentScopeIdentity.current === requestScope) setRefreshError('');
                  } catch (reason) {
                    if (currentScopeIdentity.current === requestScope)
                      setRefreshError(`Node added, but project refresh failed: ${String(reason)}`);
                  }
                })
                .catch((reason) => {
                  if (currentScopeIdentity.current === requestScope) setError(`Could not add node: ${String(reason)}`);
                });
            }}
          >
            Add node
          </button>
          <div className="graph-workspace">
            <ProductionGraphEditor
              mode="project"
              canvasRef={canvasRef}
              measurementRef={measureRef}
              renderedNodes={renderedNodes}
              graphNodes={graph.nodes}
              graphEdges={graph.edges}
              renderedEdges={
                layout.ok
                  ? layout.result.edges.flatMap((edge) => {
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
                  : []
              }
              nodePropertiesById={propertiesById}
              focusedNodeId={focusedNodeId}
              focusedNodeProperties={
                focusedNodeId ? (propertyDrafts[`${scopeIdentity}\u0000${focusedNodeId}`] ?? propertiesById[focusedNodeId] ?? []) : []
              }
              editingNodeId={editingNodeId}
              menuNodeId={menuNodeId}
              connectingNodeId={connectingNodeId}
              focusedPropertyId={focusedPropertyId}
              hoveredPropertyId={hoveredPropertyId}
              draftLabel={draftLabel}
              layoutError={!layout.ok ? <p className="layout-error">{layout.error.message}</p> : null}
              onCanvasPointerDown={(event) => {
                if (event.target instanceof Element && !event.target.closest('.node-box')) {
                  setFocusedNodeId(null);
                  setMenuNodeId(null);
                  setConnectingNodeId(null);
                  setFocusedPropertyId(null);
                  setHoveredPropertyId(null);
                }
              }}
              onNodeClick={(selected) => {
                if (connectingNodeId && connectingNodeId !== selected.id) {
                  void execute('ConnectNodes', {sourceNodeId: connectingNodeId, targetNodeId: selected.id});
                  setConnectingNodeId(null);
                  setError('');
                }
                setFocusedNodeId(selected.id);
                setFocusedPropertyId(null);
                setHoveredPropertyId(null);
                setMenuNodeId(null);
              }}
              onCloseOtherMenus={() => setMenuNodeId(null)}
              onToggleMenu={(id) => setMenuNodeId((current) => (current === id ? null : id))}
              onAddConnectedNode={(source, direction) => {
                const chapter = chapterId || projection?.nodes.find((item) => item.id === source.id)?.chapterId;
                if (!chapter) return;
                void execute('AddConnectedNode', {chapterId: chapter, sourceNodeId: source.id, label: 'New Node', direction}).then(
                  (result) => {
                    const id = result?.generatedIds?.[0];
                    if (id && currentScopeIdentity.current === scopeIdentity) {
                      setFocusedNodeId(id);
                      setEditingNodeId(id);
                      setDraftLabel('New Node');
                    }
                  },
                );
              }}
              onStartEditingNode={(node) => {
                cancelLabelRef.current = false;
                setEditingNodeId(node.id);
                setDraftLabel(node.label);
              }}
              onSetNodeType={(nodeId, newType) => void execute('ChangeNodeType', {nodeId, newType})}
              onStartConnection={(id) => {
                setConnectingNodeId(id);
                setError(`Select a node to connect from ${id}, or press Escape to cancel.`);
              }}
              onDeleteConnection={(id) => {
                const edge = graph.edges.find((item) => item.id === id);
                if (edge) void execute('DisconnectNodes', {sourceNodeId: edge.sourceId, targetNodeId: edge.targetId});
              }}
              onDeleteNode={(id) => {
                void execute('DeleteNode', {nodeId: id});
                setFocusedNodeId(null);
              }}
              onDraftLabelChange={setDraftLabel}
              onSaveEditingNode={() => void saveLabel()}
              onCancelEditing={() => {
                cancelLabelRef.current = true;
                setEditingNodeId(null);
                setDraftLabel('');
              }}
              onLabelBlur={() => {
                if (editingNodeId && document.activeElement === document.body) {
                  cancelLabelRef.current = true;
                  setEditingNodeId(null);
                  setDraftLabel('');
                } else void saveLabel();
              }}
              onFocusedPropertyChange={setFocusedPropertyId}
              onHoveredPropertyChange={setHoveredPropertyId}
              onChangeFocusedProperties={(properties) => {
                if (!focusedNodeId) return;
                const requestScope = scopeIdentity;
                const key = `${requestScope}\u0000${focusedNodeId}`;
                setPropertyDrafts((current) => ({...current, [key]: properties}));
                pendingPropertySaves.current.set(key, {
                  projectId,
                  scopeIdentity: requestScope,
                  nodeId: focusedNodeId,
                  schema: deriveNodePropertySchema(properties),
                  exampleValues: deriveNodePropertyExampleValues(properties),
                  baseRevision: projection?.revision ?? model?.revision ?? '',
                });
                if (propertySaveTimer.current !== null) window.clearTimeout(propertySaveTimer.current);
                propertySaveTimer.current = window.setTimeout(() => {
                  propertySaveTimer.current = null;
                  void drainPropertySaves();
                }, 300);
              }}
            />
          </div>
        </>
      ) : null}
    </ProductionEditorShell>
  );
}
