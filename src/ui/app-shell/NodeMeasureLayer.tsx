import type { ConstantsSection, DiagramSection } from '../../application/appViewModel';
import { NodeCard } from '../../NodeCard';

type NodeMeasureLayerProps = {
  diagram: DiagramSection;
  constants: ConstantsSection;
};

export function NodeMeasureLayer({ diagram, constants }: NodeMeasureLayerProps) {
  const { parsed, diagramMode, overviewNodeDataVisible } = diagram;
  const {
    TYPE_LABEL,
    NODE_VERSION_SUFFIX,
    NODE_MEASURE_NODE_CLASS
  } = constants;
  const hideOverviewNodeData = diagramMode === 'overview' && overviewNodeDataVisible === false;

  if (!parsed || parsed.nodes.size === 0) {
    return null;
  }
  const scenarioOnlyNodeKeys = new Set(parsed.scenarioOnlyNodeKeys);
  const diagramNodes = [...parsed.nodes.values()].filter((node) => !scenarioOnlyNodeKeys.has(node.key));

  return (
    <div className="node-measure-layer" aria-hidden="true">
      {diagramNodes.map((node) => {
        const nodePrefix = TYPE_LABEL[node.type] ?? node.type;
        const measureNode = {
          ...node,
          name: node.name.replace(NODE_VERSION_SUFFIX, '')
        };
        return (
          <div key={`measure-cell-${node.key}`} className="node-measure-cell">
            <div className={NODE_MEASURE_NODE_CLASS} data-node-key={node.key}>
              <NodeCard
                node={measureNode}
                nodePrefix={nodePrefix}
                className="node-measure-node"
                hideData={hideOverviewNodeData}
              />
            </div>
          </div>
        );
      })}
    </div>
  );
}
