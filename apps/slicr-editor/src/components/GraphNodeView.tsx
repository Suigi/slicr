import type {CSSProperties} from 'react';
import {PropertyGrid, type EditableProperty} from '@slicr/react-ui';
import {NODE_MAX_WIDTH, NODE_WIDTH} from '../graph/constants';
import {getSuccessorNodeType} from '../graph/graphUtils';
import type {AddDirection, GraphNode, NodeType, RenderNode} from '../graph/types';
import {NodeMenu} from './NodeMenu';
import {FontAwesomeIcon} from '@fortawesome/react-fontawesome';
import {faCog} from '@fortawesome/free-solid-svg-icons';

type ConnectionMenuItem = {
  id: string;
  directionLabel: 'to' | 'from';
  nodeLabel: string;
  nodeType: NodeType;
};

type GraphNodeRenderMode = 'interactive' | 'measurement' | 'read-only';

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
  const isReadOnly = renderMode === 'read-only';
  const showTransientControls = !isMeasurementMode && !isReadOnly && isFocused;
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
        isMeasurementMode || isReadOnly
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
          ) : isReadOnly ? (
            <span className="node-label-button">{node.label}</span>
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
          <FontAwesomeIcon icon={faCog} className={'node-menu-icon'} />
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

function NodeAddButton({node, direction, onAddConnectedNode}: NodeAddButtonProps) {
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
