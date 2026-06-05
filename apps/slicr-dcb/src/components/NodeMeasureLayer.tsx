import {DCB_NODE_MEASURE_CLASS} from '../nodeMeasurement';
import type {GraphNode, RenderNode} from '../graph/types';
import {GraphNodeView} from './GraphNodeView';

type NodeMeasureLayerProps = {
  nodes: readonly RenderNode[];
};

const noop = () => {};
const noopNodeHandler = (node: GraphNode) => {
  void node;
};
const noopAddConnectedNode = (node: GraphNode, direction: 'top' | 'right' | 'bottom') => {
  void node;
  void direction;
};
const noopSetNodeType = (nodeId: string, type: GraphNode['type']) => {
  void nodeId;
  void type;
};
const noopDeleteConnection = (edgeId: string) => {
  void edgeId;
};
const noopDeleteNode = (nodeId: string) => {
  void nodeId;
};
const noopLabelChange = (label: string) => {
  void label;
};

export function NodeMeasureLayer({nodes}: NodeMeasureLayerProps) {
  return (
    <div
      className="node-measure-layer"
      aria-hidden="true"
      tabIndex={-1}
      style={{position: 'absolute', inset: 0, overflow: 'hidden', pointerEvents: 'none'}}
    >
      {nodes.map((node) => (
        <div
          key={node.id}
          className={DCB_NODE_MEASURE_CLASS}
          data-node-id={node.id}
          style={{position: 'absolute', left: -10000, top: 0, pointerEvents: 'none'}}
        >
          <GraphNodeView
            node={{...node, x: 0, y: 0}}
            isFocused={false}
            isEditing={false}
            isMenuOpen={false}
            isConnectingSource={false}
            draftLabel=""
            connectionMenuItems={[]}
            renderMode="measurement"
            onNodeClick={noopNodeHandler}
            onCloseOtherMenus={noop}
            onToggleMenu={noop}
            onAddConnectedNode={noopAddConnectedNode}
            onStartEditingNode={noopNodeHandler}
            onSetNodeType={noopSetNodeType}
            onStartConnection={noop}
            onDeleteConnection={noopDeleteConnection}
            onDeleteNode={noopDeleteNode}
            onDraftLabelChange={noopLabelChange}
            onSaveEditingNode={noop}
            onCancelEditingFromKeyboard={noop}
            onLabelBlur={noop}
          />
        </div>
      ))}
    </div>
  );
}
