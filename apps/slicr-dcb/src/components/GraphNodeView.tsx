import { getSuccessorNodeType } from '../graph/graphUtils';
import type { AddDirection, GraphNode, NodeType, RenderNode } from '../graph/types';
import { NodeMenu } from './NodeMenu';

type ConnectionMenuItem = {
  id: string;
  label: string;
};

type GraphNodeViewProps = {
  node: RenderNode;
  isFocused: boolean;
  isEditing: boolean;
  isMenuOpen: boolean;
  isConnectingSource: boolean;
  draftLabel: string;
  connectionMenuItems: ConnectionMenuItem[];
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

export function GraphNodeView({
  node,
  isFocused,
  isEditing,
  isMenuOpen,
  isConnectingSource,
  draftLabel,
  connectionMenuItems,
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
  return (
    <div
      className={`node-box node-type-${node.type}${isFocused ? ' node-focused' : ''}${isConnectingSource ? ' node-connecting-source' : ''}`}
      style={{ left: node.x, top: node.y, width: node.width, height: node.height }}
      onClick={() => {
        onNodeClick(node);
        if (!isMenuOpen) {
          onCloseOtherMenus();
        }
      }}
    >
      {isFocused ? <NodeAddButton node={node} direction="top" onAddConnectedNode={onAddConnectedNode} /> : null}
      {isEditing ? (
        <input
          className="node-label-input"
          value={draftLabel}
          autoFocus
          aria-label={`Edit ${node.label} label`}
          onChange={(event) => onDraftLabelChange(event.target.value)}
          onFocus={(event) => event.currentTarget.select()}
          onBlur={onLabelBlur}
          onClick={(event) => event.stopPropagation()}
          onDoubleClick={(event) => event.stopPropagation()}
          onKeyDown={(event) => {
            if (event.key === 'Enter') {
              onSaveEditingNode();
            }
            if (event.key === 'Escape') {
              event.preventDefault();
              event.stopPropagation();
              onCancelEditingFromKeyboard();
            }
          }}
        />
      ) : (
        <button
          type="button"
          className="node-label-button"
          title="Double-click to edit"
          onDoubleClick={(event) => {
            event.stopPropagation();
            onStartEditingNode(node);
          }}
        >
          {node.label}
        </button>
      )}
      {isFocused ? (
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
          ⚙️
        </button>
      ) : null}
      {isFocused && isMenuOpen ? (
        <NodeMenu
          label={node.label}
          connectionMenuItems={connectionMenuItems}
          onSetType={(type) => onSetNodeType(node.id, type)}
          onStartConnection={() => onStartConnection(node.id)}
          onDeleteConnection={onDeleteConnection}
          onDelete={() => onDeleteNode(node.id)}
        />
      ) : null}
      {isFocused ? <NodeAddButton node={node} direction="right" onAddConnectedNode={onAddConnectedNode} /> : null}
      {isFocused ? <NodeAddButton node={node} direction="bottom" onAddConnectedNode={onAddConnectedNode} /> : null}
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
