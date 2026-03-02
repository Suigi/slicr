import type { ConstantsSection, DiagramSection } from '../../application/appViewModel';

type NodeMeasureLayerProps = {
  diagram: DiagramSection;
  constants: ConstantsSection;
};

export function NodeMeasureLayer({ diagram, constants }: NodeMeasureLayerProps) {
  const { parsed } = diagram;
  const {
    TYPE_LABEL,
    NODE_VERSION_SUFFIX,
    NODE_MEASURE_NODE_CLASS,
    MISSING_DATA_VALUE,
    formatNodeData
  } = constants;

  if (!parsed || parsed.nodes.size === 0) {
    return null;
  }

  const renderMeasureDataLine = (line: string, index: number) => {
    const match = line.match(/^(\s*(?:-\s*)?)([^:\n]+:)(.*)$/);
    if (!match) {
      return (
        <div key={index} className="node-measure-field-line">
          {line}
        </div>
      );
    }

    const value = match[3];
    const displayValue = value.startsWith(' ') ? value.slice(1) : value;
    const isMissing = displayValue.trim() === MISSING_DATA_VALUE;
    const keyWithColon = match[2];
    const key = keyWithColon.endsWith(':') ? keyWithColon.slice(0, -1) : keyWithColon;

    return (
      <div key={index} className={`node-measure-field-line${isMissing ? ' missing' : ''}`}>
        {match[1]}
        <span className="node-measure-field-key">{key}</span>
        <span className="node-measure-field-colon">:</span>
        <span className="node-measure-field-val">{displayValue}</span>
      </div>
    );
  };

  return (
    <div className="node-measure-layer" aria-hidden="true">
      {[...parsed.nodes.values()].map((node) => {
        const nodePrefix = TYPE_LABEL[node.type] ?? node.type;
        return (
          <div key={`measure-${node.key}`} className={NODE_MEASURE_NODE_CLASS} data-node-key={node.key}>
            <div className="node-measure-header">
              {nodePrefix ? <span className="node-measure-prefix">{nodePrefix}:</span> : null}
              <span className="node-measure-title">{node.alias ?? node.name.replace(NODE_VERSION_SUFFIX, '')}</span>
            </div>
            {node.data && (
              <div className="node-measure-fields">
                {formatNodeData(node.data).map((field) => (
                  <div key={`measure-${node.key}-${field.key}`} className="node-measure-field">
                    <div className="node-measure-field-lines">
                      {field.text.split('\n').map((line, index) => renderMeasureDataLine(line, index))}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
