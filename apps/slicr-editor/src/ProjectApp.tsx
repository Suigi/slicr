import {useEffect, useMemo, useRef, useState} from 'react';
import {type EditableProperty, type InfiniteCanvasHandle} from '@slicr/react-ui';
import {ProductionEditorShell} from './components/ProductionEditorShell';
import {ProductionGraphEditor} from './components/ProductionGraphEditor';
import {useProductionGraphView} from './graph/useProductionGraphView';
import {useProductionGraphController} from './graph/useProductionGraphController';
import {deriveNodePropertyExampleValues, deriveNodePropertySchema, mergeNodePropertyEditorProperties} from './graph/propertyEventMapping';
import type {NodePropertySchema, NodePropertyExampleValues} from '@slicr/core/events';
import {createProjectProductionEditorPort, ProjectCommandError} from './application/projectProductionEditorPort';
import type {EditorAction, EditorCommand, EditorSnapshot} from './application/productionEditorPort';

type Project = {id: string; name: string};
type Chapter = {id: string; title: string};
type Model = {
  projectDirectory: string;
  storeDirectory: string;
  revision: string;
  projects: Project[];
  chaptersByProjectId: Record<string, Chapter[]>;
};
const projectEditorPort = createProjectProductionEditorPort();
async function readApi<T>(url: string, signal: AbortSignal): Promise<T> {
  const response = await fetch(url, {signal, headers: {accept: 'application/json'}});
  const body = await response.json();
  if (!response.ok) throw new Error(body.error ?? `Request failed (${response.status})`);
  return body as T;
}

const writeApi = (command: EditorCommand) => projectEditorPort.execute(command);

/** Served entry point only: deliberately never imports App, useGraphModel, or any browser event store. */
export function ProjectApp() {
  const canvasRef = useRef<InfiniteCanvasHandle>(null);
  const measureRef = useRef<HTMLDivElement>(null);
  const [model, setModel] = useState<Model | null>(null);
  const [projectId, setProjectId] = useState('');
  const [chapterId, setChapterId] = useState('');
  const [projection, setProjection] = useState<EditorSnapshot | null>(null);
  const [error, setError] = useState('');
  const [refreshError, setRefreshError] = useState('');
  const [scopeSwitchNotice, setScopeSwitchNotice] = useState('');
  const readGeneration = useRef(0);
  const scopeIdentity = `${projectId}\u0000${chapterId}`;
  const currentScopeIdentity = useRef(scopeIdentity);
  currentScopeIdentity.current = scopeIdentity;
  const [isSidebarOpen, setIsSidebarOpen] = useState(true);
  const [propertyDrafts, setPropertyDrafts] = useState<Record<string, EditableProperty[]>>({});
  const [pendingScopeSwitch, setPendingScopeSwitch] = useState<{projectId: string; chapterId: string; label: string} | null>(null);
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
  const submittedPropertySave = useRef<{key: string; scopeIdentity: string} | null>(null);
  const discardedSubmittedSave = useRef<{key: string; scopeIdentity: string} | null>(null);
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
      setProjection((current) => (current?.revision === snapshot.revision ? current : snapshot));
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
      projectEditorPort.getSnapshot({projectId, chapterId}),
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
        submittedPropertySave.current = {key, scopeIdentity: pending.scopeIdentity};
        try {
          const result = await writeApi({
            scope: {projectId: pending.projectId, chapterId: pending.scopeIdentity.split('\u0000')[1]},
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
          if (discardedSubmittedSave.current?.key === key && discardedSubmittedSave.current.scopeIdentity === pending.scopeIdentity) {
            // Discard includes a submitted write: resolve its outcome without resurrecting its draft.
            propertySaveFailed.current = false;
            continue;
          }
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
        } finally {
          submittedPropertySave.current = null;
          if (discardedSubmittedSave.current?.key === key && discardedSubmittedSave.current.scopeIdentity === pending.scopeIdentity)
            discardedSubmittedSave.current = null;
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

  const execute = async (action: EditorAction) => {
    const requestScope = scopeIdentity;
    const type = action.type;
    try {
      const baseRevision = projection?.revision ?? model?.revision;
      if (type === 'RenameNode' && !projection) throw new Error('The latest project revision is not loaded.');
      if (!baseRevision) throw new Error('The latest project revision is not loaded.');
      const selectedProjectId = type === 'RenameProject' ? action.data.projectId : projectId;
      if (type !== 'AddProject' && !selectedProjectId) throw new Error('Select a project before editing it.');
      const result = await writeApi({
        ...action,
        scope: {projectId: selectedProjectId, chapterId},
        baseRevision,
      });
      if (currentScopeIdentity.current !== requestScope) return null;
      setError('');
      if (type === 'AddProject') {
        setProjection(null);
        controller.resetTransientState();
        controller.setFocusedNodeId(null);
        try {
          const updatedModel = await readApi<Model>('/api/model', new AbortController().signal);
          if (currentScopeIdentity.current !== requestScope) return null;
          const createdProjectId = result.createdIds[0];
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
        let refreshed = true;
        if (type === 'AddChapter') {
          setProjection(null);
          controller.resetTransientState();
          controller.setFocusedNodeId(null);
        }
        try {
          await refreshProjection();
          if (type === 'AddChapter') {
            const createdChapterId = result.createdIds[0];
            if (createdChapterId) setChapterId(createdChapterId);
          }
        } catch (reason) {
          refreshed = false;
          if (currentScopeIdentity.current === requestScope)
            setRefreshError(
              type === 'RenameNode'
                ? `Edit saved, but project refresh failed: ${String(reason)}`
                : `${type === 'AddChapter' ? 'Chapter' : type} saved, but project refresh failed. Do not repeat the create command. ${String(reason)}`,
            );
        }
        if (refreshed && currentScopeIdentity.current === requestScope) setRefreshError('');
      }
      return result;
    } catch (reason) {
      if (currentScopeIdentity.current === requestScope)
        setError(`Could not save ${type === 'RenameNode' ? 'edit' : type}: ${String(reason)}`);
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
    controller.resetTransientState();
    controller.setFocusedNodeId(null);
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
    discardedSubmittedSave.current = submittedPropertySave.current;
    propertySaveFailed.current = false;
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
    propertySaveFailed.current = false;
    setPendingScopeSwitch(null);
    switchScope(target.projectId, target.chapterId);
    setScopeSwitchNotice(notice);
  };

  const chapters = model?.chaptersByProjectId[projectId] ?? [];
  const graph = useMemo(
    () => ({nodes: [...(projection?.nodes ?? [])], edges: [...(projection?.edges ?? [])], lanes: [...(projection?.lanes ?? [])]}),
    [projection],
  );
  const controller = useProductionGraphController({
    ...graph,
    chapterId,
    execute,
    connectedLabel: 'New Node',
    cancelOnBodyBlur: true,
    onStartConnection: (id) => setError(id ? `Select a node to connect from ${id}, or press Escape to cancel.` : ''),
  });
  const {
    focusedNodeId,
    editingNodeId,
    draftLabel,
    openNodeMenuId: menuNodeId,
    connectingSourceNodeId: connectingNodeId,
    editorFocusedPropertyId: focusedPropertyId,
    hoveredPropertyId,
    setFocusedNodeId,
  } = controller;
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
  const {
    layoutResult: layout,
    renderedNodes,
    renderedEdges,
  } = useProductionGraphView({
    ...graph,
    focusedNodeId,
    nodePropertiesById: propertiesById,
    editingNodeId,
    draftLabel,
    measurementRef: measureRef,
  });
  useEffect(() => {
    if (focusedNodeId && !graph.nodes.some((node) => node.id === focusedNodeId)) setFocusedNodeId(null);
  }, [focusedNodeId, graph.nodes, setFocusedNodeId]);
  useEffect(() => {
    canvasRef.current?.setCamera({x: 100, y: 100, zoom: 1});
  }, []);

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
      onAddProject={(name) => void execute({type: 'AddProject', data: {name}})}
      onRenameProject={(id, name) => void execute({type: 'RenameProject', data: {projectId: id, name}})}
      onSelectChapter={(id) => {
        if (hasUnresolvedPropertyDrafts()) {
          setPendingScopeSwitch({projectId, chapterId: id, label: 'chapter'});
          return;
        }
        switchScope(projectId, id);
      }}
      onCollapseSidebar={() => setIsSidebarOpen(false)}
      onExpandSidebar={() => setIsSidebarOpen(true)}
      onAddChapter={(title) => void execute({type: 'AddChapter', data: {title}})}
      topbarActions={<strong>Project store · editing enabled</strong>}
    >
      <div className="project-store-identity" aria-label="Project store identity">
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
          <button type="button" onClick={() => void controller.addNewSlice()}>
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
              renderedEdges={renderedEdges}
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
                  controller.setFocusedNodeId(null);
                  controller.setOpenNodeMenuId(null);
                  controller.cancelConnecting();
                }
              }}
              onNodeClick={controller.onNodeClick}
              onCloseOtherMenus={() => controller.setOpenNodeMenuId(null)}
              onToggleMenu={(id) => controller.setOpenNodeMenuId((current) => (current === id ? null : id))}
              onAddConnectedNode={controller.addConnectedNode}
              onStartEditingNode={controller.startEditingNode}
              onSetNodeType={controller.setNodeType}
              onStartConnection={controller.startConnectingFromNode}
              onDeleteConnection={controller.deleteConnection}
              onDeleteNode={controller.deleteNode}
              onDraftLabelChange={controller.setDraftLabel}
              onSaveEditingNode={controller.saveEditingNode}
              onCancelEditing={controller.cancelEditingFromKeyboard}
              onLabelBlur={controller.handleLabelBlur}
              onFocusedPropertyChange={controller.setEditorFocusedPropertyId}
              onHoveredPropertyChange={controller.setHoveredPropertyId}
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
