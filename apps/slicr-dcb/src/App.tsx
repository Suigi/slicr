import { useEffect, useMemo, useRef, useState, type CSSProperties } from 'react';
import { InfiniteCanvas, PointyCardTags, PropertyEditor, PropertyGrid, type EditableProperty, type InfiniteCanvasHandle } from '@slicr/react-ui';
import { compactLayout } from 'layout-lib';
import { AppShell } from './components/AppShell';
import { ChapterSidebar, type Chapter } from './components/ChapterSidebar';
import { EdgeLayer } from './components/EdgeLayer';
import { GraphNodeView } from './components/GraphNodeView';
import { ProjectSwitcher, type Project } from './components/ProjectSwitcher';
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

const dummyProjects: Project[] = [
  { id: 'checkout-system', name: 'Checkout System' },
  { id: 'inventory-system', name: 'Inventory System' },
  { id: 'Customer Portal', name: 'Customer Portal' },
];

const dummyChapters: Chapter[] = [
  { id: 'overview', title: 'Overview' },
  { id: 'cart-events', title: 'Cart Events' },
  { id: 'payment-flow', title: 'Payment Flow' },
  { id: 'fulfillment', title: 'Fulfillment' },
];

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
  const [activeProjectId, setActiveProjectId] = useState('checkout-system');
  const [activeChapterId, setActiveChapterId] = useState('cart-events');
  const [isSidebarOpen, setIsSidebarOpen] = useState(true);
  const [isExportMenuOpen, setIsExportMenuOpen] = useState(false);
  const [propertyGridMockups, setPropertyGridMockups] = useState<PropertyGridCardMockup[]>(initialPropertyGridCardMockups);
  const [selectedPropertyGridMockupVariant, setSelectedPropertyGridMockupVariant] = useState(initialPropertyGridCardMockups[0]?.variant ?? '');
  const [nodePropertiesById, setNodePropertiesById] = useState<Record<string, EditableProperty[]>>({});
  const selectedPropertyGridMockup =
    propertyGridMockups.find((mockup) => mockup.variant === selectedPropertyGridMockupVariant) ?? propertyGridMockups[0];
  const updateSelectedPropertyGridProperties = (properties: EditableProperty[]) => {
    setPropertyGridMockups((currentMockups) =>
      currentMockups.map((mockup) =>
        mockup.variant === selectedPropertyGridMockup?.variant ? { ...mockup, properties } : mockup,
      ),
    );
  };
  const activeChapterName = dummyChapters.find((chapter) => chapter.id === activeChapterId)?.title ?? 'Untitled';
  const {
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
  } = useGraphModel();

  const layoutResult = useMemo(
    () =>
      compactLayout({
        nodes,
        edges,
        lanes,
        defaults: { nodeWidth: NODE_WIDTH, nodeHeight: NODE_HEIGHT },
        spacing: { laneMargin: 0, laneGap: 100, minTargetShift: 20, minNodeGap: 40 },
      }),
    [edges, lanes, nodes],
  );

  const renderedNodes: RenderNode[] = useMemo(() => {
    if (!layoutResult.ok) {
      return [];
    }

    const inputNodeById = new Map(nodes.map((node) => [node.id, node]));
    return layoutResult.result.nodes.flatMap((nodeLayout) => {
      const node = inputNodeById.get(nodeLayout.id);
      if (!node) {
        return [];
      }

      return [{ ...node, ...nodeLayout }];
    });
  }, [layoutResult, nodes]);

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

  const nodeById = useMemo(() => new Map(nodes.map((node) => [node.id, node])), [nodes]);
  const focusedNode = focusedNodeId ? nodeById.get(focusedNodeId) : undefined;
  const focusedNodeProperties = focusedNode ? nodePropertiesById[focusedNode.id] ?? [] : [];
  const updateFocusedNodeProperties = (properties: EditableProperty[]) => {
    if (!focusedNode) {
      return;
    }

    setNodePropertiesById((currentPropertiesById) => ({
      ...currentPropertiesById,
      [focusedNode.id]: properties,
    }));
  };
  const connectingSourceNode = connectingSourceNodeId
    ? nodes.find((node) => node.id === connectingSourceNodeId)
    : undefined;

  const exportCurrentEvents = async () => {
    await navigator.clipboard.writeText(serializeDomainEvents(await readGraphEvents()));
    setIsExportMenuOpen(false);
  };

  const exportCurrentVisualGraph = async () => {
    if (!layoutResult.ok) {
      window.alert('Cannot export a visual graph while layout is invalid.');
      setIsExportMenuOpen(false);
      return;
    }

    await navigator.clipboard.writeText(
      serializeVisualGraphAcceptanceTest({
        nodes,
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
          projects={dummyProjects}
          activeProjectId={activeProjectId}
          onSelectProject={setActiveProjectId}
        />
      }
      collapsedSidebarLabel={activeChapterName}
      isSidebarOpen={isSidebarOpen}
      onExpandSidebar={() => setIsSidebarOpen(true)}
      sidebar={
        <ChapterSidebar
          chapters={dummyChapters}
          activeChapterId={activeChapterId}
          onSelectChapter={setActiveChapterId}
          onCollapse={() => setIsSidebarOpen(false)}
        />
      }
    >
      <div className="graph-workspace">
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
            <PropertyEditor properties={focusedNodeProperties} onChange={updateFocusedNodeProperties} />
          </section>
        </aside>
      ) : null}
      <InfiniteCanvas
        ref={canvasRef}
        className="canvas"
        defaultCamera={{ x: 100, y: 100, zoom: 1 }}
        controls={{ toolbar: true }}
        viewportRef={viewportRef}
        ignorePanSelector=".node-box, .node-add-button, .node-menu-button, .node-menu, .node-label-input, .export-menu, .node-layout-mockups, .property-editor-example"
        onCanvasPointerDown={(event) => {
          if (event.target instanceof Element && !event.target.closest('.node-box')) {
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
