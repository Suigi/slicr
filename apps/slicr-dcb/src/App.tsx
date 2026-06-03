import { useEffect, useMemo, useRef, useState } from 'react';
import { InfiniteCanvas, type InfiniteCanvasHandle } from '@slicr/react-ui';
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

export function App() {
  const canvasRef = useRef<InfiniteCanvasHandle>(null);
  const viewportRef = useRef<HTMLDivElement>(null);
  const [activeProjectId, setActiveProjectId] = useState('checkout-system');
  const [activeChapterId, setActiveChapterId] = useState('cart-events');
  const [isSidebarOpen, setIsSidebarOpen] = useState(true);
  const [isExportMenuOpen, setIsExportMenuOpen] = useState(false);
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
      if (event.target instanceof Element && event.target.closest('.node-label-input')) {
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
      <InfiniteCanvas
        ref={canvasRef}
        className="canvas"
        defaultCamera={{ x: 100, y: 100, zoom: 1 }}
        controls={{ toolbar: true }}
        viewportRef={viewportRef}
        ignorePanSelector=".node-box, .node-add-button, .node-menu-button, .node-menu, .node-label-input, .export-menu"
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
