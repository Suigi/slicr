import type {PointerEvent as ReactPointerEvent, ReactNode, RefObject} from 'react';
import {InfiniteCanvas, type EditableProperty, type InfiniteCanvasHandle} from '@slicr/react-ui';
import {getArrowRenderPoints} from '../graph/graphUtils';
import type {AddDirection, GraphNode, NodeType, RenderNode} from '../graph/types';
import {EdgeLayer} from './EdgeLayer';
import {GraphNodeView} from './GraphNodeView';
import {NodeEditor} from './NodeEditor';
import {NodeMeasureLayer} from './NodeMeasureLayer';

type ArrowRenderPoints = NonNullable<ReturnType<typeof getArrowRenderPoints>>;
type GraphEdge = {id: string; sourceId: string; targetId: string; role?: 'flow' | 'back-reference'};
type RenderedEdge = {id: string; role?: 'flow' | 'back-reference'; points: ArrowRenderPoints; isConnectedToFocusedNode: boolean};
type ConnectionMenuItem = {id: string; directionLabel: 'to' | 'from'; nodeLabel: string; nodeType: NodeType};

type ProductionGraphEditorProps = {
  mode: 'standalone' | 'project';
  canvasRef: RefObject<InfiniteCanvasHandle | null>;
  viewportRef?: RefObject<HTMLDivElement | null>;
  renderedNodes: readonly RenderNode[];
  graphNodes: readonly GraphNode[];
  graphEdges: readonly GraphEdge[];
  renderedEdges: RenderedEdge[];
  nodePropertiesById: Record<string, EditableProperty[]>;
  focusedNodeId: string | null;
  focusedNodeProperties: EditableProperty[];
  editingNodeId: string | null;
  menuNodeId: string | null;
  connectingNodeId: string | null;
  focusedPropertyId: string | null;
  hoveredPropertyId: string | null;
  draftLabel: string;
  measurementRef: RefObject<HTMLDivElement | null>;
  onCanvasPointerDown: (event: ReactPointerEvent<HTMLDivElement>) => void;
  onNodeClick: (node: GraphNode) => void;
  onCloseOtherMenus: () => void;
  onToggleMenu: (nodeId: string) => void;
  onAddConnectedNode: (node: GraphNode, direction: AddDirection) => void;
  onStartEditingNode: (node: GraphNode) => void;
  onSetNodeType: (nodeId: string, type: NodeType) => void;
  onStartConnection: (nodeId: string) => void;
  onDeleteConnection: (edgeId: string) => void;
  onDeleteNode: (nodeId: string) => void;
  onDraftLabelChange: (label: string) => void;
  onSaveEditingNode: () => void;
  onCancelEditing: () => void;
  onLabelBlur: (nodeId: string) => void;
  onFocusedPropertyChange: (propertyId: string | null) => void;
  onHoveredPropertyChange: (propertyId: string | null) => void;
  onChangeFocusedProperties: (properties: EditableProperty[]) => void;
  layoutError?: ReactNode;
  children?: ReactNode;
};

/** Shared production graph, detail panel, measurement layer, and node interaction surface. */
export function ProductionGraphEditor({canvasRef, viewportRef, ...props}: ProductionGraphEditorProps) {
  const focusedNode = props.graphNodes.find((node) => node.id === props.focusedNodeId) ?? null;
  const connectingNode = props.graphNodes.find((node) => node.id === props.connectingNodeId) ?? null;
  const connectionMenuItems = (nodeId: string): ConnectionMenuItem[] =>
    props.graphEdges
      .filter((edge) => edge.sourceId === nodeId || edge.targetId === nodeId)
      .map((edge) => {
        const connectedNodeId = edge.sourceId === nodeId ? edge.targetId : edge.sourceId;
        const connectedNode = props.graphNodes.find((node) => node.id === connectedNodeId);
        return {
          id: edge.id,
          directionLabel: edge.sourceId === nodeId ? 'to' : 'from',
          nodeLabel: connectedNode?.label ?? connectedNodeId,
          nodeType: connectedNode?.type ?? 'ui',
        };
      });

  return (
    <>
      {props.connectingNodeId ? (
        <div className="connect-mode-status">
          Select a target node to connect from “{connectingNode?.label ?? props.connectingNodeId}”. Esc to cancel.
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
              properties={props.focusedNodeProperties}
              focusedPropertyId={props.hoveredPropertyId ?? props.focusedPropertyId}
              onFocusedPropertyChange={props.onFocusedPropertyChange}
              onChange={props.onChangeFocusedProperties}
            />
          </section>
        </aside>
      ) : null}
      <NodeMeasureLayer
        nodes={props.renderedNodes}
        nodePropertiesById={props.nodePropertiesById}
        editingNodeId={props.editingNodeId}
        draftLabel={props.draftLabel}
        containerRef={props.measurementRef}
      />
      <InfiniteCanvas
        ref={canvasRef}
        className="canvas"
        defaultCamera={{x: 100, y: 100, zoom: 1}}
        controls={{toolbar: true}}
        viewportRef={viewportRef}
        ignorePanSelector=".node-box, .node-add-button, .node-menu-button, .node-menu, .node-label-input, .export-menu, .node-layout-mockups, .property-editor-example"
        onCanvasPointerDown={props.onCanvasPointerDown}
        data-editor-mode={props.mode}
      >
        <EdgeLayer edges={props.renderedEdges} />
        {props.renderedNodes.map((node) => (
          <GraphNodeView
            key={node.id}
            node={node}
            properties={props.nodePropertiesById[node.id] ?? []}
            focusedPropertyId={props.hoveredPropertyId ?? props.focusedPropertyId}
            onHoveredPropertyChange={props.onHoveredPropertyChange}
            renderMode="interactive"
            isFocused={props.focusedNodeId === node.id}
            isEditing={props.editingNodeId === node.id}
            isMenuOpen={props.menuNodeId === node.id}
            isConnectingSource={props.connectingNodeId === node.id}
            draftLabel={props.editingNodeId === node.id ? props.draftLabel : ''}
            connectionMenuItems={connectionMenuItems(node.id)}
            onNodeClick={props.onNodeClick}
            onCloseOtherMenus={props.onCloseOtherMenus}
            onToggleMenu={() => props.onToggleMenu(node.id)}
            onAddConnectedNode={props.onAddConnectedNode}
            onStartEditingNode={props.onStartEditingNode}
            onSetNodeType={props.onSetNodeType}
            onStartConnection={props.onStartConnection}
            onDeleteConnection={props.onDeleteConnection}
            onDeleteNode={props.onDeleteNode}
            onDraftLabelChange={props.onDraftLabelChange}
            onSaveEditingNode={props.onSaveEditingNode}
            onCancelEditingFromKeyboard={props.onCancelEditing}
            onLabelBlur={() => props.onLabelBlur(node.id)}
          />
        ))}
        {props.children}
        {props.layoutError}
      </InfiniteCanvas>
    </>
  );
}
