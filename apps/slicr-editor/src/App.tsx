import {useEffect, useRef, useState, type CSSProperties} from 'react';
import {PointyCardTags, PropertyEditor, PropertyGrid, type EditableProperty, type InfiniteCanvasHandle} from '@slicr/react-ui';
import {ProductionEditorShell} from './components/ProductionEditorShell';
import {ProductionGraphEditor} from './components/ProductionGraphEditor';
import {BackupRestoreButtons} from './components/BackupRestoreButtons';
import {NODE_HEIGHT, NODE_WIDTH} from './graph/constants';
import {useProductionGraphView} from './graph/useProductionGraphView';
import {useEventBackup} from './application/useEventBackup';
import {storeLastOkGraphModel, useGraphModel} from './graph/useGraphModel';
import {serializeVisualGraphAcceptanceTest} from './graph/visualGraphExport';

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
  pointyTags?: {label: string; href: string}[];
};

const initialPropertyGridCardMockups: PropertyGridCardMockup[] = [
  {
    title: 'Event card with a property grid',
    variant: 'event-property-grid',
    note: 'Event styling wrapped around the compact property grid.',
    nodeClassName: 'mockup-event-node',
    nodeTitleLines: ['NodeAdded'],
    properties: [
      {id: 'event-node-id', name: 'nodeId', type: 'string'},
      {id: 'event-label', name: 'label', type: 'string'},
      {id: 'event-lane-id', name: 'laneId', type: 'string'},
      {
        id: 'event-tags',
        name: 'tags',
        type: 'Object',
        list: true,
        properties: [
          {id: 'event-tags-key', name: 'key', type: 'string'},
          {id: 'event-tags-value', name: 'value', type: 'string'},
        ],
        rows: [
          {'event-tags-key': 'nodeId', 'event-tags-value': 'node-42'},
          {'event-tags-key': 'type', 'event-tags-value': 'evt'},
        ],
      },
    ],
    pointyTags: [
      {label: 'nodeId', href: '#node-id'},
      {label: 'chapterId', href: '#chapter-id'},
      {label: 'projectId', href: '#project-id'},
    ],
  },
  {
    title: 'Read Model card with a property grid',
    variant: 'read-model-property-grid',
    note: 'Read-model styling wrapped around the compact property grid.',
    nodeClassName: 'mockup-read-model-node',
    nodeTitleLines: ['Slice', 'Overview'],
    properties: [
      {id: 'read-model-chapter-id', name: 'chapterId', type: 'string'},
      {id: 'read-model-projection-name', name: 'projectionName', type: 'string'},
      {
        id: 'read-model-columns',
        name: 'columns',
        type: 'Object',
        list: true,
        properties: [
          {id: 'read-model-columns-field', name: 'field', type: 'string'},
          {id: 'read-model-columns-type', name: 'type', type: 'string'},
          {id: 'read-model-columns-source', name: 'source', type: 'string'},
        ],
        rows: [
          {'read-model-columns-field': 'title', 'read-model-columns-type': 'string', 'read-model-columns-source': 'event'},
          {'read-model-columns-field': 'status', 'read-model-columns-type': 'string', 'read-model-columns-source': 'event'},
        ],
      },
      {
        id: 'read-model-sorts',
        name: 'sorts',
        type: 'Object',
        list: true,
        properties: [
          {id: 'read-model-sorts-field', name: 'field', type: 'string'},
          {id: 'read-model-sorts-direction', name: 'direction', type: 'string'},
          {id: 'read-model-sorts-priority', name: 'priority', type: 'number'},
          {id: 'read-model-sorts-nulls', name: 'nulls', type: 'string'},
        ],
        rows: [
          {
            'read-model-sorts-field': 'updatedAt',
            'read-model-sorts-direction': 'desc',
            'read-model-sorts-priority': '1',
            'read-model-sorts-nulls': 'last',
          },
          {
            'read-model-sorts-field': 'title',
            'read-model-sorts-direction': 'asc',
            'read-model-sorts-priority': '2',
            'read-model-sorts-nulls': 'first',
          },
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
      {id: 'command-id', name: 'commandId', type: 'string'},
      {id: 'command-requested-by', name: 'requestedBy', type: 'string'},
      {id: 'command-target-lane', name: 'targetLane', type: 'string'},
      {
        id: 'command-payload',
        name: 'payload',
        type: 'Object',
        list: true,
        properties: [
          {id: 'command-payload-name', name: 'name', type: 'string'},
          {id: 'command-payload-type', name: 'type', type: 'string'},
        ],
        rows: [
          {'command-payload-name': 'label', 'command-payload-type': 'string'},
          {'command-payload-name': 'nodeType', 'command-payload-type': 'NodeType'},
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
      {id: 'location-label', name: 'label', type: 'string', example: 'Home'},
      {
        id: 'location-address',
        name: 'address',
        type: 'Object',
        properties: [
          {id: 'location-address-street', name: 'street', type: 'string', example: 'Fake Street 123'},
          {id: 'location-address-city', name: 'city', type: 'string', example: 'Springfield'},
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
  const [propertyGridMockups, setPropertyGridMockups] = useState<PropertyGridCardMockup[]>(initialPropertyGridCardMockups);
  const [selectedPropertyGridMockupVariant, setSelectedPropertyGridMockupVariant] = useState(
    initialPropertyGridCardMockups[0]?.variant ?? '',
  );
  const selectedPropertyGridMockup =
    propertyGridMockups.find((mockup) => mockup.variant === selectedPropertyGridMockupVariant) ?? propertyGridMockups[0];
  const updateSelectedPropertyGridProperties = (properties: EditableProperty[]) => {
    setPropertyGridMockups((currentMockups) =>
      currentMockups.map((mockup) => (mockup.variant === selectedPropertyGridMockup?.variant ? {...mockup, properties} : mockup)),
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
    highlightedPropertyId,
    editingNodeId,
    draftLabel,
    openNodeMenuId,
    connectingSourceNodeId,
    focusedNodeProperties = [],
    nodePropertiesById = {},
    updateFocusedNodeProperties = () => {},
    setFocusedNodeId,
    setEditorFocusedPropertyId,
    setHoveredPropertyId,
    setDraftLabel,
    setOpenNodeMenuId,
    reload,
    revertToLastOkGraphModel,
    addNewSlice,
    addProject,
    renameProject,
    addChapter,
    startConnectingFromNode,
    cancelConnecting,
    onNodeClick,
    deleteConnection,
    addConnectedNode,
    deleteNode,
    setNodeType,
    startEditingNode,
    saveEditingNode,
    cancelEditingFromKeyboard,
    handleLabelBlur,
  } = useGraphModel({activeProjectId: selectedProjectId, activeChapterId: selectedChapterId});
  const eventBackup = useEventBackup();

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
  const handleAddChapter = async (title: string) => {
    const newChapterId = await addChapter(title);
    if (newChapterId) {
      setSelectedChapterId(newChapterId);
    }
  };

  const {layoutNodes, layoutResult, renderedNodes, renderedEdges, isMeasurementSettled} = useProductionGraphView({
    nodes,
    edges,
    lanes,
    focusedNodeId,
    nodePropertiesById,
    editingNodeId,
    draftLabel,
    measurementRef: measurementLayerRef,
  });

  const backupEventsToClipboard = async () => {
    try {
      const text = await eventBackup.backupText();
      await navigator.clipboard.writeText(text);
    } catch (error) {
      window.alert(error instanceof Error ? error.message : 'Backup failed.');
    }
  };

  const exportCurrentVisualGraph = async () => {
    if (!isMeasurementSettled) {
      window.alert('Cannot export a visual graph until measurement and layout have settled.');
      return;
    }

    if (!layoutResult.ok) {
      window.alert('Cannot export a visual graph while layout is invalid.');
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
  };

  const restoreBackupFromClipboard = async () => {
    const clipboardText = await navigator.clipboard.readText();

    if (!window.confirm('Restore backup? This will replace all local event data.')) {
      return;
    }

    try {
      await eventBackup.restoreFrom(clipboardText);
      await reload({preserveScope: true});
    } catch (error) {
      window.alert(error instanceof Error ? error.message : 'Restore failed.');
    }
  };

  useEffect(() => {
    if (layoutResult.ok) {
      storeLastOkGraphModel({nodes, edges, lanes});
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

  return (
    <ProductionEditorShell
      projects={workspace.projects}
      chapters={activeChapters}
      projectId={effectiveProjectId}
      chapterId={effectiveChapterId}
      isSidebarOpen={isSidebarOpen}
      onSelectProject={(projectId) => {
        setSelectedProjectId(projectId);
        setSelectedChapterId(null);
      }}
      onAddProject={addProject}
      onRenameProject={renameProject}
      onSelectChapter={setSelectedChapterId}
      onAddChapter={handleAddChapter}
      onCollapseSidebar={() => setIsSidebarOpen(false)}
      onExpandSidebar={() => setIsSidebarOpen(true)}
      topbarActions={
        <BackupRestoreButtons onBackup={() => void backupEventsToClipboard()} onRestore={() => void restoreBackupFromClipboard()} />
      }
    >
      <div className="graph-workspace" data-measurement-settled={isMeasurementSettled ? 'true' : 'false'}>
        <div className="overlay-actions">
          <button type="button" className="new-slice-button" onClick={addNewSlice}>
            + New Slice
          </button>
          <button type="button" className="overlay-action-button" onClick={() => void exportCurrentVisualGraph()}>
            Export layout-lib vitest case
          </button>
        </div>
        <ProductionGraphEditor
          mode="standalone"
          canvasRef={canvasRef}
          viewportRef={viewportRef}
          renderedNodes={renderedNodes}
          graphNodes={nodes}
          graphEdges={edges}
          renderedEdges={renderedEdges}
          nodePropertiesById={nodePropertiesById}
          focusedNodeId={focusedNodeId}
          focusedNodeProperties={focusedNodeProperties}
          editingNodeId={editingNodeId}
          menuNodeId={openNodeMenuId}
          connectingNodeId={connectingSourceNodeId}
          focusedPropertyId={highlightedPropertyId}
          hoveredPropertyId={highlightedPropertyId}
          draftLabel={draftLabel}
          measurementRef={measurementLayerRef}
          onCanvasPointerDown={(event) => {
            if (event.target instanceof Element && !event.target.closest('.node-box')) {
              if (
                document.activeElement instanceof HTMLElement &&
                document.activeElement.matches('.project-switcher-option-add-input, .chapter-sidebar-create-input')
              ) {
                document.activeElement.blur();
              }
              setFocusedNodeId(null);
              setOpenNodeMenuId(null);
              cancelConnecting();
            }
          }}
          onNodeClick={onNodeClick}
          onCloseOtherMenus={() => setOpenNodeMenuId(null)}
          onToggleMenu={(nodeId) => setOpenNodeMenuId((currentId) => (currentId === nodeId ? null : nodeId))}
          onAddConnectedNode={addConnectedNode}
          onStartEditingNode={startEditingNode}
          onSetNodeType={setNodeType}
          onStartConnection={startConnectingFromNode}
          onDeleteConnection={deleteConnection}
          onDeleteNode={deleteNode}
          onDraftLabelChange={setDraftLabel}
          onSaveEditingNode={saveEditingNode}
          onCancelEditing={cancelEditingFromKeyboard}
          onLabelBlur={() => handleLabelBlur()}
          onFocusedPropertyChange={setEditorFocusedPropertyId}
          onHoveredPropertyChange={setHoveredPropertyId}
          onChangeFocusedProperties={updateFocusedNodeProperties}
        >
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
                <button type="button" onClick={() => void backupEventsToClipboard()}>
                  Copy event backup
                </button>
              </div>
            </div>
          ) : null}
        </ProductionGraphEditor>
      </div>
    </ProductionEditorShell>
  );
}
