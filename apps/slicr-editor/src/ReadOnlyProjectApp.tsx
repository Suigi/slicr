import {useEffect, useMemo, useRef, useState} from 'react';
import {InfiniteCanvas, type InfiniteCanvasHandle} from '@slicr/react-ui';
import {compactLayout} from 'layout-lib';
import {AppShell} from './components/AppShell';
import {EdgeLayer} from './components/EdgeLayer';
import {GraphNodeView} from './components/GraphNodeView';
import {NodeMeasureLayer} from './components/NodeMeasureLayer';
import {NODE_HEIGHT, NODE_WIDTH, laneIdForOrder} from './graph/constants';
import {getArrowRenderPoints} from './graph/graphUtils';
import {mergeNodePropertyEditorProperties} from './graph/propertyEventMapping';
import type {GraphNode, NodeType, RenderNode} from './graph/types';
import type {NodePropertySchema, NodePropertyExampleValues} from '@slicr/core/events';
import {measureNodeDimensions, type NodeDimensions} from './nodeMeasurement';

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
  nodes: {id: string; label: string; type: NodeType; laneId: number}[];
  edges: {sourceNodeId: string; targetNodeId: string; role: 'flow' | 'back-reference'}[];
  nodeSchemas: Record<string, NodePropertySchema[]>;
  nodeExampleValues: Record<string, NodePropertyExampleValues[]>;
};

async function readApi<T>(url: string, signal: AbortSignal): Promise<T> {
  const response = await fetch(url, {signal, headers: {accept: 'application/json'}});
  const body = await response.json();
  if (!response.ok) throw new Error(body.error ?? `Request failed (${response.status})`);
  return body as T;
}

const noop = () => {};

async function writeApi(command: {projectId: string; type: string; data: Record<string, unknown>}) {
  const response = await fetch('/api/command', {
    method: 'POST',
    headers: {'content-type': 'application/json', accept: 'application/json'},
    body: JSON.stringify(command),
  });
  const body = await response.json();
  if (!response.ok) throw new Error(body.error ?? `Request failed (${response.status})`);
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
  const [measurements, setMeasurements] = useState<Record<string, NodeDimensions>>({});
  const [editingNodeId, setEditingNodeId] = useState<string | null>(null);
  const [draftLabel, setDraftLabel] = useState('');

  useEffect(() => {
    const controller = new AbortController();
    readApi<Model>('/api/model', controller.signal)
      .then((next) => {
        setModel(next);
        setProjectId(next.projects[0]?.id ?? '');
      })
      .catch((reason: unknown) => {
        if (!controller.signal.aborted) setError(`Could not load project model: ${String(reason)}`);
      });
    return () => controller.abort();
  }, []);

  useEffect(() => {
    if (!projectId) return;
    const controller = new AbortController();
    const query = new URLSearchParams({project: projectId});
    if (chapterId) query.set('chapter', chapterId);
    readApi<Projection>(`/api/projection?${query}`, controller.signal)
      .then((next) => {
        setProjection(next);
        setError('');
      })
      .catch((reason: unknown) => {
        if (!controller.signal.aborted) setError(`Could not load project projection: ${String(reason)}`);
      });
    return () => controller.abort();
  }, [projectId, chapterId]);

  // Poll the disk-backed projection: store subscriptions are process-local and cannot observe CLI writes.
  useEffect(() => {
    if (!projectId) return;
    const timer = window.setInterval(() => {
      const query = new URLSearchParams({project: projectId});
      if (chapterId) query.set('chapter', chapterId);
      const controller = new AbortController();
      readApi<Projection>(`/api/projection?${query}`, controller.signal)
        .then((next) => setProjection((current) => (current?.revision === next.revision ? current : next)))
        .catch(() => {});
      readApi<Model>('/api/model', controller.signal)
        .then(setModel)
        .catch(() => {});
    }, 1000);
    return () => window.clearInterval(timer);
  }, [projectId, chapterId]);

  const refreshProjection = async () => {
    if (!projectId) return;
    const query = new URLSearchParams({project: projectId});
    if (chapterId) query.set('chapter', chapterId);
    const controller = new AbortController();
    const [next, nextModel] = await Promise.all([
      readApi<Projection>(`/api/projection?${query}`, controller.signal),
      readApi<Model>('/api/model', controller.signal),
    ]);
    setProjection(next);
    setModel(nextModel);
  };
  const saveLabel = async () => {
    if (!editingNodeId || !projectId) return;
    try {
      await writeApi({projectId, type: 'RenameNode', data: {nodeId: editingNodeId, name: draftLabel}});
      setEditingNodeId(null);
      setError('');
      await refreshProjection();
    } catch (reason) {
      setError(`Could not save edit: ${String(reason)}`);
    }
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
    const next = measureNodeDimensions(measureRef.current ?? document);
    setMeasurements((current) => (JSON.stringify(current) === JSON.stringify(next) ? current : next));
  }, [projection, propertiesById]);
  useEffect(() => {
    canvasRef.current?.setCamera({x: 100, y: 100, zoom: 1});
  }, []);

  return (
    <AppShell
      projectSwitcher={
        <label className="read-only-selector">
          Project
          <select
            aria-label="Project"
            value={projectId}
            onChange={(event) => {
              setProjection(null);
              setChapterId('');
              setProjectId(event.target.value);
            }}
          >
            {model?.projects.map((project) => (
              <option key={project.id} value={project.id}>
                {project.name} ({project.id})
              </option>
            ))}
          </select>
        </label>
      }
      sidebar={
        <aside className="read-only-navigation">
          <h2>Chapters</h2>
          <label>
            Chapter
            <select
              aria-label="Chapter"
              value={chapterId}
              onChange={(event) => {
                setProjection(null);
                setChapterId(event.target.value);
              }}
            >
              <option value="">All chapters</option>
              {chapters.map((chapter) => (
                <option key={chapter.id} value={chapter.id}>
                  {chapter.title} ({chapter.id})
                </option>
              ))}
            </select>
          </label>
        </aside>
      }
      collapsedSidebarLabel={chapters.find((chapter) => chapter.id === chapterId)?.title ?? 'All chapters'}
      isSidebarOpen={true}
      onExpandSidebar={noop}
      topbarActions={<strong>Project store · editing enabled</strong>}
    >
      <div className="read-only-identity" aria-label="Project store identity">
        <strong>Project-backed editor · project store</strong>
        <div>Project directory: {model?.projectDirectory ?? 'Loading…'}</div>
        <div>Store: {model?.storeDirectory ?? 'Loading…'}</div>
        <div>Revision: {projection?.revision ?? model?.revision ?? 'Loading…'}</div>
      </div>
      {error ? <p role="alert">{error}</p> : null}
      {!model && !error ? <p>Loading project model…</p> : null}
      {model && !projectId ? <p>No projects in this model.</p> : null}
      {projectId && !projection && !error ? <p>Loading project projection…</p> : null}
      {projection && !error ? (
        <>
          <button
            type="button"
            onClick={() => {
              const chapter = chapterId || chapters[0]?.id;
              if (!chapter) {
                setError('Select a chapter before adding a node.');
                return;
              }
              void writeApi({
                projectId,
                type: 'AddNode',
                data: {chapterId: chapter, nodeType: 'ui', laneId: graph.nodes.length, label: `Node ${graph.nodes.length + 1}`},
              })
                .then(refreshProjection)
                .catch((reason) => setError(`Could not add node: ${String(reason)}`));
            }}
          >
            Add node
          </button>
          <div className="graph-workspace">
            <NodeMeasureLayer
              nodes={renderedNodes}
              nodePropertiesById={propertiesById}
              editingNodeId={null}
              draftLabel=""
              containerRef={measureRef}
            />
            <InfiniteCanvas ref={canvasRef} className="canvas" defaultCamera={{x: 100, y: 100, zoom: 1}} controls={{toolbar: true}}>
              {layout.ok ? (
                <EdgeLayer
                  edges={layout.result.edges.flatMap((edge) => {
                    const points = getArrowRenderPoints(edge.points);
                    return points ? [{id: edge.id, role: edge.role, points, isConnectedToFocusedNode: false}] : [];
                  })}
                />
              ) : (
                <p className="layout-error">{layout.error.message}</p>
              )}
              {renderedNodes.map((node) => (
                <GraphNodeView
                  key={node.id}
                  node={node}
                  properties={propertiesById[node.id] ?? []}
                  renderMode="interactive"
                  isFocused={false}
                  isEditing={editingNodeId === node.id}
                  isMenuOpen={false}
                  isConnectingSource={false}
                  draftLabel={editingNodeId === node.id ? draftLabel : ''}
                  connectionMenuItems={[]}
                  onNodeClick={noop}
                  onCloseOtherMenus={noop}
                  onToggleMenu={noop}
                  onAddConnectedNode={noop}
                  onStartEditingNode={(selected) => {
                    setEditingNodeId(selected.id);
                    setDraftLabel(selected.label);
                  }}
                  onSetNodeType={noop}
                  onStartConnection={noop}
                  onDeleteConnection={noop}
                  onDeleteNode={noop}
                  onDraftLabelChange={setDraftLabel}
                  onSaveEditingNode={() => void saveLabel()}
                  onCancelEditingFromKeyboard={noop}
                  onLabelBlur={() => {
                    if (editingNodeId === node.id) void saveLabel();
                  }}
                />
              ))}
            </InfiniteCanvas>
          </div>
        </>
      ) : null}
    </AppShell>
  );
}
