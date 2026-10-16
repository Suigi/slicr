import {useEffect} from 'react';
import {getKeyboardSuccessorDirection, getKeyboardSuccessorNodeType} from './graphUtils';
import type {GraphNode} from './types';

type Edge = {sourceId: string; targetId: string};

/** Shared production keyboard workflow. Storage/API differences stay in the supplied actions. */
export function useGraphKeyboardInteractions(options: {
  nodes: GraphNode[];
  edges: Edge[];
  focusedNodeId: string | null;
  connectingNodeId: string | null;
  onCancelConnection(): void;
  onStartConnection(nodeId: string): void;
  onAddConnectedNode(node: GraphNode, direction: 'top' | 'right' | 'bottom', type: GraphNode['type']): void;
  onStartEditing(node: GraphNode): void;
  onDeleteNode(nodeId: string): void;
  onFocusNode(nodeId: string): void;
  onCloseMenus(): void;
}) {
  const {
    nodes,
    edges,
    focusedNodeId,
    connectingNodeId,
    onCancelConnection,
    onStartConnection,
    onAddConnectedNode,
    onStartEditing,
    onDeleteNode,
    onFocusNode,
    onCloseMenus,
  } = options;

  useEffect(() => {
    const navigate = (event: KeyboardEvent) => {
      if (event.target instanceof Element && event.target.closest('.node-label-input, .property-editor')) return;
      if (event.key === 'Escape' && connectingNodeId) {
        event.preventDefault();
        onCancelConnection();
        return;
      }
      if (!focusedNodeId) return;
      const focused = nodes.find((node) => node.id === focusedNodeId);
      if (!focused) return;
      if (event.key.toLowerCase() === 'c') {
        event.preventDefault();
        onStartConnection(focusedNodeId);
      } else if (event.key === 'Enter') {
        event.preventDefault();
        onCloseMenus();
        if (event.ctrlKey || event.metaKey) {
          onAddConnectedNode(focused, getKeyboardSuccessorDirection(focused.type), getKeyboardSuccessorNodeType(focused.type));
        } else onStartEditing(focused);
      } else if (event.key === 'Backspace' && event.metaKey) {
        event.preventDefault();
        onDeleteNode(focusedNodeId);
      } else if (event.key === 'ArrowLeft' || event.key === 'ArrowRight') {
        const edge = edges.find((item) => (event.key === 'ArrowLeft' ? item.targetId : item.sourceId) === focusedNodeId);
        if (edge) {
          event.preventDefault();
          onFocusNode(event.key === 'ArrowLeft' ? edge.sourceId : edge.targetId);
          onCloseMenus();
        }
      }
    };
    window.addEventListener('keydown', navigate);
    return () => window.removeEventListener('keydown', navigate);
  }, [
    nodes,
    edges,
    focusedNodeId,
    connectingNodeId,
    onCancelConnection,
    onStartConnection,
    onAddConnectedNode,
    onStartEditing,
    onDeleteNode,
    onFocusNode,
    onCloseMenus,
  ]);
}
