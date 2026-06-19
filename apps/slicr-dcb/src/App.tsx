import { useEffect, useLayoutEffect, useMemo, useRef, useState, type CSSProperties } from 'react';
import { InfiniteCanvas, PointyCardTags, PropertyEditor, PropertyGrid, type EditableProperty, type InfiniteCanvasHandle } from '@slicr/react-ui';
import { compactLayout } from 'layout-lib';
import { AppShell } from './components/AppShell';
import { ChapterSidebar } from './components/ChapterSidebar';
import { EdgeLayer } from './components/EdgeLayer';
import { GraphNodeView } from './components/GraphNodeView';
import { NodeEditor } from './components/NodeEditor';
import { NodeMeasureLayer } from './components/NodeMeasureLayer';
import { ProjectSwitcher } from './components/ProjectSwitcher';
import { NODE_HEIGHT, NODE_WIDTH } from './graph/constants';
import {
  getArrowRenderPoints,
  getKeyboardSuccessorDirection,
  getKeyboardSuccessorNodeType,
} from './graph/graphUtils';
import {parseImportEvents, serializeDomainEvents} from './graph/importExport';
import { storeLastOkGraphModel, useGraphModel } from './graph/useGraphModel';
import {serializeVisualGraphAcceptanceTest} from './graph/visualGraphExport';
import type { RenderNode } from './graph/types';
import {measureNodeDimensions, type NodeDimensions} from './nodeMeasurement';

const propertyGridColorScheme = {
  '--property-grid-line': 'var(--mockup-grid-line)',
  '--property-grid-table-header-bg': 'var(--mockup-node-bg)',
  '--property-grid-table-header-text': 'var(--mockup-node-accent)',
  '--property-grid-muted-text': '#64748b',
  '--property-grid-text': '#172033',
  '--property-grid-value-text': '#172033',
} as CSSProperties;

type PropertyGridCardMockup = {
  title: string;
  variant: string;
  note: string;
  nodeClassName: string;
  nodeTitleLines: string[];
  properties: EditableProperty[];
  pointyTags?: { label: string; href: string }[];
};

function areNodeMeasurementMapsEqual(
  current: Record<string, NodeDimensions>,
  next: Record<string, NodeDimensions>,
) {
  const currentKeys = Object.keys(current);
  const nextKeys = Object.keys(next);

  if (currentKeys.length !== nextKeys.length) {
    return false;
  }

  return currentKeys.every((nodeId) => {
    const currentDimensions = current[nodeId];
    const nextDimensions = next[nodeId];
    return currentDimensions?.width === nextDimensions?.width && currentDimensions?.height === nextDimensions?.height;
  });
}

const initialPropertyGridCardMockups: PropertyGridCardMockup[] = [
  {
    title: 'Event card with a property grid',
    variant: 'event-property-grid',
    note: 'Event styling wrapped around the compact property grid.',
    nodeClassName: 'mockup-event-node',
    nodeTitleLines: ['NodeAdded'],
    properties: [
      { id: 'event-node-id', name: 'nodeId', type: 'string' },
      { id: 'event-label', name: 'label', type: 'string' },
      { id: 'event-lane-id', name: 'laneId', type: 'string' },
      {
        id: 'event-tags',
        name: 'tags',
        type: 'Object',
        list: true,
        properties: [
          { id: 'event-tags-key', name: 'key', type: 'string' },
          { id: 'event-tags-value', name: 'value', type: 'string' },
        ],
        rows: [
          { 'event-tags-key': 'nodeId', 'event-tags-value': 'node-42' },
          { 'event-tags-key': 'type', 'event-tags-value': 'evt' },
        ],
      },
    ],
    pointyTags: [
      { label: 'nodeId', href: '#node-id' },
      { label: 'chapterId', href: '#chapter-id' },
      { label: 'projectId', href: '#project-id' },
    ],
  },
  {
    title: 'Read Model card with a property grid',
    variant: 'read-model-property-grid',
    note: 'Read-model styling wrapped around the compact property grid.',
    nodeClassName: 'mockup-read-model-node',
    nodeTitleLines: ['Slice', 'Overview'],
    properties: [
      { id: 'read-model-chapter-id', name: 'chapterId', type: 'string' },
      { id: 'read-model-projection-name', name: 'projectionName', type: 'string' },
      {
        id: 'read-model-columns',
        name: 'columns',
        type: 'Object',
        list: true,
        properties: [
          { id: 'read-model-columns-field', name: 'field', type: 'string' },
          { id: 'read-model-columns-type', name: 'type', type: 'string' },
          { id: 'read-model-columns-source', name: 'source', type: 'string' },
        ],
        rows: [
          { 'read-model-columns-field': 'title', 'read-model-columns-type': 'string', 'read-model-columns-source': 'event' },
          { 'read-model-columns-field': 'status', 'read-model-columns-type': 'string', 'read-model-columns-source': 'event' },
        ],
      },
      {
        id: 'read-model-sorts',
        name: 'sorts',
        type: 'Object',
        list: true,
        properties: [
          { id: 'read-model-sorts-field', name: 'field', type: 'string' },
          { id: 'read-model-sorts-direction', name: 'direction', type: 'string' },
          { id: 'read-model-sorts-priority', name: 'priority', type: 'number' },
          { id: 'read-model-sorts-nulls', name: 'nulls', type: 'string' },
        ],
        rows: [
          { 'read-model-sorts-field': 'updatedAt', 'read-model-sorts-direction': 'desc', 'read-model-sorts-priority': '1', 'read-model-sorts-nulls': 'last' },
          { 'read-model-sorts-field': 'title', 'read-model-sorts-direction': 'asc', 'read-model-sorts-priority': '2', 'read-model-sorts-nulls': 'first' },
        ],
      },
    ],
  },
  {
    title: 'Command card with a property grid',
    variant: 'command-property-grid',
    note: 'Command styling wrapped around the compact property grid.',
    nodeClassName: 'mockup-command-node',
    nodeTitleLines: ['CreateNode'],
    properties: [
      { id: 'command-id', name: 'commandId', type: 'string' },
      { id: 'command-requested-by', name: 'requestedBy', type: 'string' },
      { id: 'command-target-lane', name: 'targetLane', type: 'string' },
      {
        id: 'command-payload',
        name: 'payload',
        type: 'Object',
        list: true,
        properties: [
          { id: 'command-payload-name', name: 'name', type: 'string' },
          { id: 'command-payload-type', name: 'type', type: 'string' },
        ],
        rows: [
          { 'command-payload-name': 'label', 'command-payload-type': 'string' },
          { 'command-payload-name': 'nodeType', 'command-payload-type': 'NodeType' },
        ],
      },
    ],
  },
  {
    title: 'Event card with a complex property',
    variant: 'complex-property-grid',
    note: 'Complex values show a typed parent row and one-level nested property table.',
    nodeClassName: 'mockup-event-node',
    nodeTitleLines: ['LocationChanged'],
    properties: [
      { id: 'location-label', name: 'label', type: 'string', example: 'Home' },
      {
        id: 'location-address',
        name: 'address',
        type: 'Object',
        properties: [
          { id: 'location-address-street', name: 'street', type: 'string', example: 'Fake Street 123' },
          { id: 'location-address-city', name: 'city', type: 'string', example: 'Springfield' },
        ],
      },
    ],
  },
];

export function App() {
  const canvasRef = useRef<InfiniteCanvasHandle>(null);
  const viewportRef = useRef<HTMLDivElement>(null);
  const measurementLayerRef = useRef<HTMLDivElement>(null);
  const [selectedProjectId, setSelectedProjectId] = useState<string | null>(null);
  const [selectedChapterId, setSelectedChapterId] = useState<string | null>(null);
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [isExportMenuOpen, setIsExportMenuOpen] = useState(false);
  const [propertyGridMockups, setPropertyGridMockups] = useState<PropertyGridCardMockup[]>(initialPropertyGridCardMockups);
  const [selectedPropertyGridMockupVariant, setSelectedPropertyGridMockupVariant] = useState(initialPropertyGridCardMockups[0]?.variant ?? '');
  const [nodeMeasurements, setNodeMeasurements] = useState<Record<string, NodeDimensions>>({});
  const [settledMeasurementKey, setSettledMeasurementKey] = useState('');
  const [editorFocusedPropertyId, setEditorFocusedPropertyId] = useState<string | null>(null);
  const [hoveredPropertyId, setHoveredPropertyId] = useState<string | null>(null);
  const highlightedPropertyId = hoveredPropertyId ?? editorFocusedPropertyId;
  const selectedPropertyGridMockup =
    propertyGridMockups.find((mockup) => mockup.variant === selectedPropertyGridMockupVariant) ?? propertyGridMockups[0];
  const updateSelectedPropertyGridProperties = (properties: EditableProperty[]) => {
    setPropertyGridMockups((currentMockups) =>
      currentMockups.map((mockup) =>
        mockup.variant === selectedPropertyGridMockup?.variant ? { ...mockup, properties } : mockup,
      ),
    );
  };
  const {
    workspace = {projects: [], chaptersByProjectId: {}},
    activeProjectId,
    activeChapterId,
    nodes,
    edges,
    lanes,
    focusedNodeId,
    editingNodeId,
    draftLabel,
    openNodeMenuId,
    connectingSourceNodeId,
    focusedNodeProperties = [],
    nodePropertiesById = {},
    updateFocusedNodeProperties = () => {},
    setFocusedNodeId,
    setDraftLabel,
    setOpenNodeMenuId,
    readGraphEvents,
    replaceGraphEvents,
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
  } = useGraphModel({activeProjectId: selectedProjectId, activeChapterId: selectedChapterId});

  const selectedProjectExists = workspace.projects.some((project) => project.id === selectedProjectId);
  const resolvedProjectExists = workspace.projects.some((project) => project.id === activeProjectId);
  const effectiveProjectId = selectedProjectExists
    ? (selectedProjectId ?? '')
    : resolvedProjectExists
      ? activeProjectId
      : (workspace.projects[0]?.id ?? '');
  const activeChapters = workspace.chaptersByProjectId[effectiveProjectId] ?? [];
  const selectedChapterExists = activeChapters.some((chapter) => chapter.id === selectedChapterId);
  const resolvedChapterExists = activeChapters.some((chapter) => chapter.id === activeChapterId);
  const effectiveChapterId = selectedChapterExists
    ? (selectedChapterId ?? '')
    : resolvedChapterExists
      ? activeChapterId
      : (activeChapters[0]?.id ?? '');
  const activeChapterName = activeChapters.find((chapter) => chapter.id === effectiveChapterId)?.title ?? 'Untitled';

  const handleAddChapter = async (title: string) => {
    const newChapterId = await addChapter(title);
    if (newChapterId) {
      setSelectedChapterId(newChapterId);
    }
  };

  const layoutNodes = useMemo(
    () =>
      nodes.map((node) => {
        const measuredDimensions = nodeMeasurements[node.id];
        return measuredDimensions
          ? {
              ...node,
              width: NODE_WIDTH,
              height: Math.max(NODE_HEIGHT, measuredDimensions.height),
            }
          : {
              ...node,
              width: NODE_WIDTH,
            };
      }),
    [nodeMeasurements, nodes],
  );

  const layoutResult = useMemo(
    () =>
      compactLayout({
        nodes: layoutNodes,
        edges,
        lanes,
        defaults: { nodeWidth: NODE_WIDTH, nodeHeight: NODE_HEIGHT },
        spacing: { laneMargin: 0, laneGap: 100, minTargetShift: 20, minNodeGap: 40 },
      }),
    [edges, lanes, layoutNodes],
  );

  const renderedNodes: RenderNode[] = useMemo(() => {
    if (!layoutResult.ok) {
      return [];
    }

    const inputNodeById = new Map(layoutNodes.map((node) => [node.id, node]));
    return layoutResult.result.nodes.flatMap((nodeLayout) => {
      const node = inputNodeById.get(nodeLayout.id);
      if (!node) {
        return [];
      }

      return [{ ...node, ...nodeLayout }];
    });
  }, [layoutNodes, layoutResult]);

  const arrowRenderPoints = layoutResult.ok
    ? layoutResult.result.edges
        .map((edge) => ({
          id: edge.id,
          role: edge.role,
          points: getArrowRenderPoints(edge.points),
          isConnectedToFocusedNode: edge.sourceId === focusedNodeId || edge.targetId === focusedNodeId,
        }))
        .filter(
          (
            edge,
          ): edge is {
            id: string;
            role: 'flow' | 'back-reference' | undefined;
            points: NonNullable<ReturnType<typeof getArrowRenderPoints>>;
            isConnectedToFocusedNode: boolean;
          } => Boolean(edge.points),
        )
    : [];

  const measurementStateKey = useMemo(
    () => JSON.stringify({nodes, nodePropertiesById, editingNodeId, draftLabel}),
    [draftLabel, editingNodeId, nodePropertiesById, nodes],
  );
  const isMeasurementSettled = settledMeasurementKey === measurementStateKey;

  useLayoutEffect(() => {
    let cancelled = false;

    queueMicrotask(() => {
      if (cancelled) {
        return;
      }

      const measuredDimensions = measureNodeDimensions(measurementLayerRef.current ?? document);
      setNodeMeasurements((currentMeasurements) =>
        areNodeMeasurementMapsEqual(currentMeasurements, measuredDimensions) ? currentMeasurements : measuredDimensions,
      );
      setSettledMeasurementKey(measurementStateKey);
    });

    return () => {
      cancelled = true;
    };
  }, [measurementStateKey]);

  const nodeById = useMemo(() => new Map(nodes.map((node) => [node.id, node])), [nodes]);
  const focusedNode = focusedNodeId ? nodeById.get(focusedNodeId) : undefined;
  const connectingSourceNode = connectingSourceNodeId
    ? nodes.find((node) => node.id === connectingSourceNodeId)
    : undefined;

  useEffect(() => {
    setEditorFocusedPropertyId(null);
    setHoveredPropertyId(null);
  }, [focusedNodeId]);

  const exportCurrentEvents = async () => {
    await navigator.clipboard.writeText(serializeDomainEvents(await readGraphEvents()));
    setIsExportMenuOpen(false);
  };

  const exportCurrentVisualGraph = async () => {
    if (!isMeasurementSettled) {
      window.alert('Cannot export a visual graph until measurement and layout have settled.');
      setIsExportMenuOpen(false);
      return;
    }

    if (!layoutResult.ok) {
      window.alert('Cannot export a visual graph while layout is invalid.');
      setIsExportMenuOpen(false);
      return;
    }

    await navigator.clipboard.writeText(
      serializeVisualGraphAcceptanceTest({
        nodes: layoutNodes,
        edges,
        lanes,
        defaults: {nodeWidth: NODE_WIDTH, nodeHeight: NODE_HEIGHT},
        spacing: {laneMargin: 0, laneGap: 100, minTargetShift: 20, minNodeGap: 40},
        result: layoutResult.result,
      }),
    );
    setIsExportMenuOpen(false);
  };

  const importGraphModelFromClipboard = async () => {
    const clipboardText = await navigator.clipboard.readText();
    const importResult = parseImportEvents(clipboardText);
    if (!importResult.ok) {
      window.alert(importResult.error);
      return;
    }

    await replaceGraphEvents(importResult.events);
  };

  useEffect(() => {
    if (layoutResult.ok) {
      storeLastOkGraphModel({ nodes, edges, lanes });
    }
  }, [edges, lanes, layoutResult.ok, nodes]);

  useEffect(() => {
    const positionCameraAtInitialMargin = () => {
      canvasRef.current?.setCamera({
        x: 100,
        y: 100,
        zoom: 1,
      });
    };

    positionCameraAtInitialMargin();
  }, []);

  useEffect(() => {
    const navigateFocusedNode = (event: KeyboardEvent) => {
      if (event.target instanceof Element && event.target.closest('.node-label-input, .property-editor')) {
        return;
      }

      if (event.key === 'Escape' && connectingSourceNodeId) {
        event.preventDefault();
        cancelConnecting();
        return;
      }

      if (!focusedNodeId) {
        return;
      }

      if (event.key.toLowerCase() === 'c') {
        event.preventDefault();
        startConnectingFromNode(focusedNodeId);
        return;
      }

      if (event.key === 'Enter') {
        const focusedNode = nodes.find((node) => node.id === focusedNodeId);
        if (focusedNode) {
          event.preventDefault();
          setOpenNodeMenuId(null);
          if (event.ctrlKey || event.metaKey) {
            addConnectedNode(
              focusedNode,
              getKeyboardSuccessorDirection(focusedNode.type),
              getKeyboardSuccessorNodeType(focusedNode.type),
            );
          } else {
            startEditingNode(focusedNode);
          }
        }
        return;
      }

      if (event.key === 'Backspace' && event.metaKey) {
        event.preventDefault();
        deleteNode(focusedNodeId);
        return;
      }

      if (event.key === 'ArrowLeft') {
        const predecessorEdge = edges.find((edge) => edge.targetId === focusedNodeId);
        if (predecessorEdge) {
          event.preventDefault();
          setFocusedNodeId(predecessorEdge.sourceId);
          setOpenNodeMenuId(null);
        }
      }

      if (event.key === 'ArrowRight') {
        const successorEdge = edges.find((edge) => edge.sourceId === focusedNodeId);
        if (successorEdge) {
          event.preventDefault();
          setFocusedNodeId(successorEdge.targetId);
          setOpenNodeMenuId(null);
        }
      }
    };

    window.addEventListener('keydown', navigateFocusedNode);
    return () => window.removeEventListener('keydown', navigateFocusedNode);
  }, [
    addConnectedNode,
    cancelConnecting,
    connectingSourceNodeId,
    deleteNode,
    edges,
    focusedNodeId,
    nodes,
    setFocusedNodeId,
    setOpenNodeMenuId,
    startConnectingFromNode,
    startEditingNode,
  ]);

  return (
    <AppShell
      projectSwitcher={
        <ProjectSwitcher
          projects={workspace.projects}
          activeProjectId={effectiveProjectId}
          onSelectProject={(projectId) => {
            setSelectedProjectId(projectId);
            setSelectedChapterId(null);
          }}
          onAddProject={addProject}
          onRenameProject={renameProject}
        />
      }
      collapsedSidebarLabel={activeChapterName}
      isSidebarOpen={isSidebarOpen}
      onExpandSidebar={() => setIsSidebarOpen(true)}
      sidebar={
        <ChapterSidebar
          chapters={activeChapters}
          activeChapterId={effectiveChapterId}
          onSelectChapter={setSelectedChapterId}
          onCollapse={() => setIsSidebarOpen(false)}
          onAddChapter={handleAddChapter}
        />
      }
    >
      <div className="graph-workspace" data-measurement-settled={isMeasurementSettled ? 'true' : 'false'}>
        <div className="overlay-actions">
        <button type="button" className="new-slice-button" onClick={addNewSlice}>
          + New Slice
        </button>
        <div className="export-menu-container">
          <button
            type="button"
            className="overlay-action-button"
            aria-haspopup="menu"
            aria-expanded={isExportMenuOpen}
            onClick={() => setIsExportMenuOpen((isOpen) => !isOpen)}
          >
            Export ▾
          </button>
          {isExportMenuOpen ? (
            <div className="export-menu" role="menu">
              <button type="button" role="menuitem" onClick={() => void exportCurrentEvents()}>
                Export events
              </button>
              <button type="button" role="menuitem" onClick={() => void exportCurrentVisualGraph()}>
                Export layout-lib vitest case
              </button>
            </div>
          ) : null}
        </div>
        <button type="button" className="overlay-action-button" onClick={() => void importGraphModelFromClipboard()}>
          Import
        </button>
      </div>
      {connectingSourceNode ? (
        <div className="connect-mode-status">
          Select a target node to connect from “{connectingSourceNode.label}”. Esc to cancel.
        </div>
      ) : null}
      {focusedNode ? (
        <aside className="node-detail-panel" aria-label="Focused node details">
          <h2 className={`node-detail-title node-detail-title-${focusedNode.type}`}>{focusedNode.label}</h2>
          <section className="node-detail-properties" aria-labelledby="node-detail-properties-heading">
            <h3 id="node-detail-properties-heading" className="node-detail-properties-heading">
              Properties
            </h3>
            <NodeEditor
              properties={focusedNodeProperties}
              focusedPropertyId={highlightedPropertyId}
              onFocusedPropertyChange={setEditorFocusedPropertyId}
              onChange={updateFocusedNodeProperties}
            />
          </section>
        </aside>
      ) : null}
      <NodeMeasureLayer
        nodes={renderedNodes}
        nodePropertiesById={nodePropertiesById}
        editingNodeId={editingNodeId}
        draftLabel={draftLabel}
        containerRef={measurementLayerRef}
      />
      <InfiniteCanvas
        ref={canvasRef}
        className="canvas"
        defaultCamera={{ x: 100, y: 100, zoom: 1 }}
        controls={{ toolbar: true }}
        viewportRef={viewportRef}
        ignorePanSelector=".node-box, .node-add-button, .node-menu-button, .node-menu, .node-label-input, .export-menu, .node-layout-mockups, .property-editor-example"
        onCanvasPointerDown={(event) => {
          if (event.target instanceof Element && !event.target.closest('.node-box')) {
            if (document.activeElement instanceof HTMLElement && document.activeElement.matches('.project-switcher-option-add-input, .chapter-sidebar-create-input')) {
              document.activeElement.blur();
            }
            setFocusedNodeId(null);
            setOpenNodeMenuId(null);
            cancelConnecting();
          }
        }}
      >
        <EdgeLayer edges={arrowRenderPoints} />
        {renderedNodes.map((node) => (
          <GraphNodeView
            key={node.id}
            node={node}
            isFocused={focusedNodeId === node.id}
            isEditing={editingNodeId === node.id}
            isMenuOpen={openNodeMenuId === node.id}
            isConnectingSource={connectingSourceNodeId === node.id}
            draftLabel={draftLabel}
            connectionMenuItems={edges
              .filter((edge) => edge.sourceId === node.id || edge.targetId === node.id)
              .map((edge) => {
                const connectedNodeId = edge.sourceId === node.id ? edge.targetId : edge.sourceId;
                const connectedNode = nodeById.get(connectedNodeId);
                return {
                  id: edge.id,
                  directionLabel: edge.sourceId === node.id ? 'to' : 'from',
                  nodeLabel: connectedNode?.label ?? connectedNodeId,
                  nodeType: connectedNode?.type ?? 'ui',
                };
              })}
            properties={nodePropertiesById[node.id] ?? []}
            onNodeClick={(clickedNode) => {
              if (connectingSourceNodeId) {
                addConnection(connectingSourceNodeId, clickedNode.id);
                return;
              }

              setFocusedNodeId(clickedNode.id);
            }}
            onCloseOtherMenus={() => setOpenNodeMenuId(null)}
            onToggleMenu={() => setOpenNodeMenuId((currentId) => (currentId === node.id ? null : node.id))}
            onAddConnectedNode={addConnectedNode}
            onStartEditingNode={startEditingNode}
            onSetNodeType={setNodeType}
            onStartConnection={startConnectingFromNode}
            onDeleteConnection={deleteConnection}
            onDeleteNode={deleteNode}
            onDraftLabelChange={setDraftLabel}
            onSaveEditingNode={saveEditingNode}
            onCancelEditingFromKeyboard={cancelEditingFromKeyboard}
            onLabelBlur={handleLabelBlur}
            focusedPropertyId={highlightedPropertyId}
            onHoveredPropertyChange={setHoveredPropertyId}
          />
        ))}
        <section className="node-layout-mockups" aria-label="Node content layout mockups">
          <div className="mockups-heading">
            <p className="mockups-eyebrow">Node content layout experiments</p>
            <h2>Properties, tags, and read-model table preview</h2>
          </div>
          <div className="mockup-grid">
            {propertyGridMockups.map((mockup) => {
              const isSelectedMockup = mockup.variant === selectedPropertyGridMockup?.variant;

              return (
              <article
                key={`property-grid-${mockup.variant}`}
                className={`mockup-card mockup-${mockup.variant} mockup-property-grid-card`}
              >
                <div className="mockup-card-heading">
                  <h3>{mockup.title}</h3>
                  <p>{mockup.note}</p>
                </div>
                <div
                  className={`mockup-node ${mockup.nodeClassName} mockup-thingy-node${isSelectedMockup ? ' mockup-node-selected' : ''}`}
                  role="button"
                  tabIndex={0}
                  aria-pressed={isSelectedMockup}
                  aria-label={`Select ${mockup.nodeTitleLines.join(' ')} mockup node`}
                  onClick={() => setSelectedPropertyGridMockupVariant(mockup.variant)}
                  onKeyDown={(event) => {
                    if (event.key === 'Enter' || event.key === ' ') {
                      event.preventDefault();
                      setSelectedPropertyGridMockupVariant(mockup.variant);
                    }
                  }}
                >
                  <div className="mockup-node-title-row">
                    <strong className="mockup-node-title-text">
                      {mockup.nodeTitleLines.map((line) => (
                        <span key={line}>{line}</span>
                      ))}
                    </strong>
                  </div>
                  <PropertyGrid properties={mockup.properties} style={propertyGridColorScheme} />
                  {mockup.pointyTags ? (
                    <PointyCardTags className="mockup-pointy-card-tags" tags={mockup.pointyTags} ariaLabel="Event card tags" />
                  ) : null}
                </div>
              </article>
              );
            })}
          </div>
        </section>
        <section className="property-editor-example" aria-label="Property editor example">
          <div className="mockups-heading">
            <p className="mockups-eyebrow">Schema editor experiment</p>
            <h2>PropertyEditor: {selectedPropertyGridMockup?.nodeTitleLines.join(' / ') ?? 'No mockup selected'}</h2>
          </div>
          {selectedPropertyGridMockup ? (
            <>
              <PropertyEditor properties={selectedPropertyGridMockup.properties} onChange={updateSelectedPropertyGridProperties} />
              <PropertyGrid
                properties={selectedPropertyGridMockup.properties}
                style={propertyGridColorScheme}
                ariaLabel={`${selectedPropertyGridMockup.nodeTitleLines.join(' ')} edited node properties`}
              />
            </>
          ) : null}
        </section>
        {!layoutResult.ok ? (
          <div className="layout-error">
            <div>{layoutResult.error.message}</div>
            <div className="layout-error-actions">
              <button type="button" onClick={revertToLastOkGraphModel}>
                Revert to last valid model
              </button>
              <button type="button" onClick={() => void exportCurrentEvents()}>
                Copy current model
              </button>
            </div>
          </div>
        ) : null}
      </InfiniteCanvas>
      </div>
    </AppShell>
  );
}
