import type { CSSProperties } from 'react';
import { PropertyGrid, type EditableProperty } from '@slicr/react-ui';
import { NODE_MAX_WIDTH, NODE_WIDTH } from '../graph/constants';
import { getSuccessorNodeType } from '../graph/graphUtils';
import type { AddDirection, GraphNode, NodeType, RenderNode } from '../graph/types';
import { NodeMenu } from './NodeMenu';

type ConnectionMenuItem = {
  id: string;
  directionLabel: 'to' | 'from';
  nodeLabel: string;
  nodeType: NodeType;
};

type GraphNodeRenderMode = 'interactive' | 'measurement';

type GraphNodeViewProps = {
  node: RenderNode;
  properties?: readonly EditableProperty[];
  isFocused: boolean;
  isEditing: boolean;
  isMenuOpen: boolean;
  isConnectingSource: boolean;
  draftLabel: string;
  connectionMenuItems: ConnectionMenuItem[];
  renderMode?: GraphNodeRenderMode;
  focusedPropertyId?: string | null;
  onHoveredPropertyChange?: (propertyId: string | null) => void;
  onNodeClick: (node: GraphNode) => void;
  onCloseOtherMenus: () => void;
  onToggleMenu: () => void;
  onAddConnectedNode: (node: GraphNode, direction: AddDirection) => void;
  onStartEditingNode: (node: GraphNode) => void;
  onSetNodeType: (nodeId: string, type: NodeType) => void;
  onStartConnection: (nodeId: string) => void;
  onDeleteConnection: (edgeId: string) => void;
  onDeleteNode: (nodeId: string) => void;
  onDraftLabelChange: (label: string) => void;
  onSaveEditingNode: () => void;
  onCancelEditingFromKeyboard: () => void;
  onLabelBlur: () => void;
};

const propertyGridColorScheme = {
  '--property-grid-line': 'var(--node-grid-line)',
  '--property-grid-table-header-bg': 'var(--node-bg)',
  '--property-grid-table-header-text': 'var(--node-accent)',
  '--property-grid-muted-text': '#64748b',
  '--property-grid-text': '#172033',
  '--property-grid-value-text': '#172033',
} as CSSProperties;

export function GraphNodeView({
  node,
  properties = [],
  isFocused,
  isEditing,
  isMenuOpen,
  isConnectingSource,
  draftLabel,
  connectionMenuItems,
  renderMode = 'interactive',
  focusedPropertyId = null,
  onHoveredPropertyChange,
  onNodeClick,
  onCloseOtherMenus,
  onToggleMenu,
  onAddConnectedNode,
  onStartEditingNode,
  onSetNodeType,
  onStartConnection,
  onDeleteConnection,
  onDeleteNode,
  onDraftLabelChange,
  onSaveEditingNode,
  onCancelEditingFromKeyboard,
  onLabelBlur,
}: GraphNodeViewProps) {
  const isMeasurementMode = renderMode === 'measurement';
  const showTransientControls = !isMeasurementMode && isFocused;
  const showNodeMenu = showTransientControls && isMenuOpen;
  const hasProperties = properties.length > 0;
  const nodeStyle = isMeasurementMode
    ? hasProperties
      ? {
          position: 'relative' as const,
          width: NODE_WIDTH,
          maxWidth: NODE_MAX_WIDTH,
        }
      : {position: 'relative' as const, width: NODE_WIDTH}
    : {left: node.x, top: node.y, width: node.width, height: node.height, maxWidth: NODE_MAX_WIDTH};

  return (
    <div
      className={`node-box node-type-${node.type}${hasProperties ? ' node-box-with-properties' : ''}${showTransientControls ? ' node-focused' : ''}${!isMeasurementMode && isConnectingSource ? ' node-connecting-source' : ''}`}
      style={nodeStyle}
      onClick={
        isMeasurementMode
          ? undefined
          : () => {
              onNodeClick(node);
              if (!isMenuOpen) {
                onCloseOtherMenus();
              }
            }
      }
    >
      {showTransientControls ? <NodeAddButton node={node} direction="top" onAddConnectedNode={onAddConnectedNode} /> : null}
      <div className={hasProperties ? 'node-content-with-properties' : 'node-content-simple'}>
        <div className={hasProperties ? 'node-title-row' : undefined}>
          {isEditing ? (
            <input
              className="node-label-input"
              value={draftLabel}
              autoFocus={!isMeasurementMode}
              readOnly={isMeasurementMode}
              tabIndex={isMeasurementMode ? -1 : undefined}
              aria-label={`Edit ${node.label} label`}
              onChange={isMeasurementMode ? undefined : (event) => onDraftLabelChange(event.target.value)}
              onFocus={isMeasurementMode ? undefined : (event) => event.currentTarget.select()}
              onBlur={isMeasurementMode ? undefined : onLabelBlur}
              onClick={isMeasurementMode ? undefined : (event) => event.stopPropagation()}
              onDoubleClick={isMeasurementMode ? undefined : (event) => event.stopPropagation()}
              onKeyDown={
                isMeasurementMode
                  ? undefined
                  : (event) => {
                      if (event.key === 'Enter') {
                        onSaveEditingNode();
                      }
                      if (event.key === 'Escape') {
                        event.preventDefault();
                        event.stopPropagation();
                        onCancelEditingFromKeyboard();
                      }
                    }
              }
            />
          ) : (
            <button
              type="button"
              className="node-label-button"
              title="Double-click to edit"
              onDoubleClick={
                isMeasurementMode
                  ? undefined
                  : (event) => {
                      event.stopPropagation();
                      onStartEditingNode(node);
                    }
              }
            >
              {node.label}
            </button>
          )}
        </div>
        {hasProperties ? (
          <PropertyGrid
            className="node-property-grid"
            properties={properties}
            focusedPropertyId={focusedPropertyId}
            onHoveredPropertyChange={isFocused ? onHoveredPropertyChange : undefined}
            style={propertyGridColorScheme}
            ariaLabel={`${node.label} properties`}
          />
        ) : null}
      </div>
      {showTransientControls ? (
        <button
          type="button"
          className="node-menu-button"
          aria-label={`Open ${node.label} options`}
          aria-expanded={isMenuOpen}
          onClick={(event) => {
            event.stopPropagation();
            onToggleMenu();
          }}
        >
          <svg className="node-menu-icon" viewBox="0 0 512 512" aria-hidden="true" focusable="false">
            <path d="M495.9 166.6c3.2 8.7 .5 18.4-6.4 24.6l-43.3 39.4c1.1 8.3 1.7 16.8 1.7 25.4s-.6 17.1-1.7 25.4l43.3 39.4c6.9 6.2 9.6 15.9 6.4 24.6-4.4 12-9.7 23.6-15.8 34.7l-4.7 8.1c-6.6 11-14 21.4-22.1 31.2-5.9 7.2-15.7 9.6-24.5 6.8l-55.7-17.7c-13.4 10.3-28.2 18.9-44 25.4l-12.5 57.1c-2 9.1-9 16.3-18.2 17.8-13.8 2.3-27.9 3.5-42.4 3.5s-28.6-1.2-42.4-3.5c-9.2-1.5-16.2-8.7-18.2-17.8l-12.5-57.1c-15.8-6.5-30.6-15.1-44-25.4l-55.7 17.7c-8.8 2.8-18.6 .3-24.5-6.8-8.1-9.8-15.5-20.2-22.1-31.2l-4.7-8.1c-6.1-11.1-11.4-22.7-15.8-34.7-3.2-8.7-.5-18.4 6.4-24.6l43.3-39.4c-1.1-8.3-1.7-16.8-1.7-25.4s.6-17.1 1.7-25.4L22.5 191.2c-6.9-6.2-9.6-15.9-6.4-24.6 4.4-12 9.7-23.6 15.8-34.7l4.7-8.1c6.6-11 14-21.4 22.1-31.2 5.9-7.2 15.7-9.6 24.5-6.8l55.7 17.7c13.4-10.3 28.2-18.9 44-25.4l12.5-57.1c2-9.1 9-16.3 18.2-17.8C227.4 1.2 241.5 0 256 0s28.6 1.2 42.4 3.5c9.2 1.5 16.2 8.7 18.2 17.8l12.5 57.1c15.8 6.5 30.6 15.1 44 25.4l55.7-17.7c8.8-2.8 18.6-.3 24.5 6.8 8.1 9.8 15.5 20.2 22.1 31.2l4.7 8.1c6.1 11.1 11.4 22.7 15.8 34.7zM256 336a80 80 0 1 0 0-160 80 80 0 1 0 0 160z" />
          </svg>
        </button>
      ) : null}
      {showNodeMenu ? (
        <NodeMenu
          label={node.label}
          connectionMenuItems={connectionMenuItems}
          onSetType={(type) => onSetNodeType(node.id, type)}
          onStartConnection={() => onStartConnection(node.id)}
          onDeleteConnection={onDeleteConnection}
          onDelete={() => onDeleteNode(node.id)}
        />
      ) : null}
      {showTransientControls ? <NodeAddButton node={node} direction="right" onAddConnectedNode={onAddConnectedNode} /> : null}
      {showTransientControls ? <NodeAddButton node={node} direction="bottom" onAddConnectedNode={onAddConnectedNode} /> : null}
    </div>
  );
}

type NodeAddButtonProps = {
  node: RenderNode;
  direction: AddDirection;
  onAddConnectedNode: (node: GraphNode, direction: AddDirection) => void;
};

function NodeAddButton({ node, direction, onAddConnectedNode }: NodeAddButtonProps) {
  const positionLabel = direction === 'top' ? 'above' : direction === 'right' ? 'to the right of' : 'below';

  return (
    <button
      type="button"
      className={`node-add-button node-add-button-${direction} node-add-button-${getSuccessorNodeType(node.type, direction)}`}
      aria-label={`Add node ${positionLabel} ${node.label}`}
      onClick={(event) => {
        event.stopPropagation();
        onAddConnectedNode(node, direction);
      }}
    >
      +
    </button>
  );
}
