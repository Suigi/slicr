import {useCallback, useEffect, useRef, useState} from 'react';
import type {EdgeInput, LaneInput} from 'layout-lib';
import type {EditorAction, EditorCommandResult} from '../application/productionEditorPort';
import {getLaneOrder, getSuccessorNodeType} from './graphUtils';
import {useGraphKeyboardInteractions} from './useGraphKeyboardInteractions';
import type {AddDirection, GraphNode, NodeType} from './types';

type Policy = {
  nodes: GraphNode[];
  edges: EdgeInput[];
  lanes: LaneInput[];
  chapterId: string;
  execute(action: EditorAction): Promise<EditorCommandResult | null | undefined> | undefined;
  onFocusChange?(nodeId: string | null): void;
  onCancelEdit?(nodeId: string, originalLabel: string): void;
  onStartConnection?(nodeId: string | null): void;
  connectedLabel?: string;
  /** Only standalone treats a blur to document.body after a canvas gesture as cancellation. */
  cancelOnBodyBlur?: boolean;
};

function wouldCreateCycle(edges: EdgeInput[], sourceId: string, targetId: string) {
  const visited = new Set<string>();
  const queue = [targetId];
  while (queue.length) {
    const id = queue.pop()!;
    if (id === sourceId) return true;
    if (visited.has(id)) continue;
    visited.add(id);
    queue.push(...edges.filter((edge) => edge.sourceId === id).map((edge) => edge.targetId));
  }
  return false;
}

/** Shared transient graph gestures. Persistence errors, revision selection and scope switching belong to each caller's policy. */
export function useProductionGraphController(policy: Policy) {
  const [focusedNodeId, setFocus] = useState<string | null>(null);
  const [editorFocusedPropertyId, setEditorFocusedPropertyId] = useState<string | null>(null);
  const [hoveredPropertyId, setHoveredPropertyId] = useState<string | null>(null);
  const [editingNodeId, setEditingNodeId] = useState<string | null>(null);
  const [draftLabel, setDraftLabel] = useState('');
  const [originalLabel, setOriginalLabel] = useState('');
  const [openNodeMenuId, setOpenNodeMenuId] = useState<string | null>(null);
  const [connectingSourceNodeId, setConnectingSourceNodeId] = useState<string | null>(null);
  const skipBlurSaveRef = useRef(false);
  const cancelEditRef = useRef(false);
  const savingRef = useRef(false);
  const focusedRef = useRef<string | null>(null);
  const policyRef = useRef(policy);
  policyRef.current = policy;

  const setFocusedNodeId = useCallback((id: string | null) => {
    focusedRef.current = id;
    setFocus(id);
    setEditorFocusedPropertyId(null);
    setHoveredPropertyId(null);
    policyRef.current.onFocusChange?.(id);
  }, []);
  const resetTransientState = useCallback(() => {
    setEditingNodeId(null);
    setDraftLabel('');
    setOriginalLabel('');
    setOpenNodeMenuId(null);
    setConnectingSourceNodeId(null);
    skipBlurSaveRef.current = false;
    cancelEditRef.current = false;
  }, []);
  const startEditingNode = (node: GraphNode) => {
    skipBlurSaveRef.current = false;
    cancelEditRef.current = false;
    setFocusedNodeId(node.id);
    setConnectingSourceNodeId(null);
    setEditingNodeId(node.id);
    setDraftLabel(node.label);
    setOriginalLabel(node.label);
  };
  const startCreatedNode = (id: string, label: string) => {
    setFocusedNodeId(id);
    setOpenNodeMenuId(null);
    setConnectingSourceNodeId(null);
    skipBlurSaveRef.current = false;
    cancelEditRef.current = false;
    setEditingNodeId(id);
    setDraftLabel(label);
    setOriginalLabel(label);
  };
  const run = (action: EditorAction) => policy.execute(action);
  const addNewSlice = async () => {
    const label = `Node ${policy.nodes.length + 1}`;
    const result = await run({type: 'AddNode', data: {chapterId: policy.chapterId, nodeType: 'ui', laneId: 0, label}});
    if (result?.createdIds[0]) startCreatedNode(result.createdIds[0], label);
  };
  const addConnectedNode = (source: GraphNode, direction: AddDirection, type?: NodeType) => {
    const order = getLaneOrder(policy.lanes, source.laneId);
    const label = policy.connectedLabel ?? `Node ${policy.nodes.length + 1}`;
    void (async () => {
      const result = await run({
        type: 'AddConnectedNode',
        data: {
          chapterId: policy.chapterId,
          sourceNodeId: source.id,
          nodeType: type ?? getSuccessorNodeType(source.type, direction),
          laneId: order + (direction === 'top' ? -1 : direction === 'bottom' ? 1 : 0),
          direction,
          label,
        },
      });
      if (result?.createdIds[0]) startCreatedNode(result.createdIds[0], label);
    })();
  };
  const startConnectingFromNode = (id: string) => {
    setFocusedNodeId(id);
    setOpenNodeMenuId(null);
    setConnectingSourceNodeId(id);
    policy.onStartConnection?.(id);
  };
  const cancelConnecting = () => {
    setConnectingSourceNodeId(null);
    policy.onStartConnection?.(null);
  };
  const addConnection = (sourceId: string, targetId: string) => {
    if (sourceId === targetId) return;
    if (policy.edges.some((edge) => edge.sourceId === sourceId && edge.targetId === targetId)) {
      cancelConnecting();
      setFocusedNodeId(targetId);
      return;
    }
    const role = wouldCreateCycle(policy.edges, sourceId, targetId) ? 'back-reference' : undefined;
    void (async () => {
      const result = await run({type: 'ConnectNodes', data: {sourceNodeId: sourceId, targetNodeId: targetId, role}});
      if (result === null) return;
      cancelConnecting();
      setFocusedNodeId(targetId);
      setOpenNodeMenuId(null);
    })();
  };
  const onNodeClick = (node: GraphNode) => {
    if (connectingSourceNodeId) {
      addConnection(connectingSourceNodeId, node.id);
      return;
    }
    setFocusedNodeId(node.id);
    setOpenNodeMenuId(null);
  };
  const deleteConnection = (edgeId: string) => {
    const edge = policy.edges.find((item) => item.id === edgeId);
    if (edge) void run({type: 'DisconnectNodes', data: {edgeId, sourceNodeId: edge.sourceId, targetNodeId: edge.targetId}});
  };
  const deleteNode = (id: string) => {
    const predecessor = policy.edges.find((edge) => edge.targetId === id)?.sourceId ?? null;
    void (async () => {
      const result = await run({type: 'DeleteNode', data: {nodeId: id}});
      if (result === null) return;
      if (editingNodeId === id) {
        setEditingNodeId(null);
        setDraftLabel('');
      }
      if (openNodeMenuId === id) setOpenNodeMenuId(null);
      if (connectingSourceNodeId === id) cancelConnecting();
      if (focusedRef.current === id) setFocusedNodeId(predecessor);
    })();
  };
  const setNodeType = (id: string, type: NodeType) => {
    void (async () => {
      const result = await run({type: 'ChangeNodeType', data: {nodeId: id, newType: type}});
      if (result !== null) setOpenNodeMenuId(null);
    })();
  };
  const saveEditingNode = useCallback(() => {
    if (!editingNodeId || cancelEditRef.current || savingRef.current) return;
    const id = editingNodeId;
    savingRef.current = true;
    void (async () => {
      try {
        const result = await policy.execute({type: 'RenameNode', data: {nodeId: id, name: draftLabel.trim() || 'Untitled'}});
        if (result === null) return;
        cancelEditRef.current = false;
        setEditingNodeId(null);
        setDraftLabel('');
        setOriginalLabel('');
      } finally {
        savingRef.current = false;
      }
    })();
  }, [draftLabel, editingNodeId, policy]);
  const cancelEditingNode = () => {
    cancelEditRef.current = true;
    if (editingNodeId) policy.onCancelEdit?.(editingNodeId, originalLabel);
    setEditingNodeId(null);
    setDraftLabel('');
    setOriginalLabel('');
  };
  const cancelEditingFromKeyboard = () => {
    skipBlurSaveRef.current = true;
    cancelEditingNode();
  };
  const handleLabelBlur = () => {
    if (skipBlurSaveRef.current) {
      skipBlurSaveRef.current = false;
      cancelEditRef.current = false;
      return;
    }
    if (policy.cancelOnBodyBlur && document.activeElement === document.body) cancelEditingNode();
    else saveEditingNode();
  };
  useEffect(() => {
    if (!editingNodeId) return;
    const outside = (event: PointerEvent) => {
      if (event.target instanceof Element && event.target.closest('.node-label-input')) return;
      if (policy.cancelOnBodyBlur) skipBlurSaveRef.current = true;
      saveEditingNode();
    };
    document.addEventListener('pointerdown', outside, true);
    return () => document.removeEventListener('pointerdown', outside, true);
  }, [editingNodeId, policy.cancelOnBodyBlur, saveEditingNode]);
  useGraphKeyboardInteractions({
    nodes: policy.nodes,
    edges: policy.edges,
    focusedNodeId,
    connectingNodeId: connectingSourceNodeId,
    onCancelConnection: cancelConnecting,
    onStartConnection: startConnectingFromNode,
    onAddConnectedNode: addConnectedNode,
    onStartEditing: startEditingNode,
    onDeleteNode: deleteNode,
    onFocusNode: setFocusedNodeId,
    onCloseMenus: () => setOpenNodeMenuId(null),
  });
  return {
    focusedNodeId,
    editorFocusedPropertyId,
    hoveredPropertyId,
    highlightedPropertyId: hoveredPropertyId ?? editorFocusedPropertyId,
    editingNodeId,
    draftLabel,
    openNodeMenuId,
    connectingSourceNodeId,
    setFocusedNodeId,
    setEditorFocusedPropertyId,
    setHoveredPropertyId,
    setDraftLabel,
    setOpenNodeMenuId,
    resetTransientState,
    startCreatedNode,
    addNewSlice,
    addConnectedNode,
    startConnectingFromNode,
    cancelConnecting,
    addConnection,
    onNodeClick,
    deleteConnection,
    deleteNode,
    setNodeType,
    startEditingNode,
    saveEditingNode,
    cancelEditingFromKeyboard,
    handleLabelBlur,
  };
}
