import { CSSProperties, MouseEvent, PointerEvent } from 'react';
import { formatNodeData } from './domain/formatNodeData';
import { MISSING_DATA_VALUE } from './domain/dataMapping';
import { VisualNode } from './domain/types';

type NodeCardProps = {
  node: VisualNode;
  nodePrefix: string;
  className?: string;
  style?: CSSProperties;
  maxFields?: number;
  onMouseEnter?: () => void;
  onMouseLeave?: () => void;
  onClick?: (event: MouseEvent<HTMLDivElement>) => void;
  onDoubleClick?: (event: MouseEvent<HTMLDivElement>) => void;
  onPointerDown?: (event: PointerEvent<HTMLDivElement>) => void;
};

export function NodeCard(props: NodeCardProps) {
  const fields = formatNodeData(props.node.data);
  const displayedFields = props.maxFields ? fields.slice(0, props.maxFields) : fields;
  const classes = ['node', props.node.type || 'rm', props.className ?? ''].filter(Boolean).join(' ');

  return (
    <div
      className={classes}
      style={props.style}
      onMouseEnter={props.onMouseEnter}
      onMouseLeave={props.onMouseLeave}
      onClick={props.onClick}
      onDoubleClick={props.onDoubleClick}
      onPointerDown={props.onPointerDown}
    >
      <div className="node-header">
        {props.nodePrefix ? <span className="node-prefix">{props.nodePrefix}:</span> : null}
        <span className="node-title">{props.node.alias ?? props.node.name}</span>
      </div>

      {props.node.data && (
        <div className="node-fields">
          {displayedFields.map((field) => (
            <div
              key={`${props.node.key}-${field.key}`}
              className={`node-field${props.node.mappedDataKeys?.has(field.key) ? ' mapped' : ''}`}
            >
              <div className="node-field-lines">
                {field.text.split('\n').map((line, index) => renderNodeDataLine(line, index))}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function renderNodeDataLine(line: string, index: number) {
  const match = line.match(/^(\s*(?:-\s*)?)([^:\n]+:)(.*)$/);
  if (!match) {
    return (
      <div key={index} className="node-field-line">
        {line}
      </div>
    );
  }

  const value = match[3];
  const isMissing = value.trim() === MISSING_DATA_VALUE;
  const keyWithColon = match[2];
  const key = keyWithColon.endsWith(':') ? keyWithColon.slice(0, -1) : keyWithColon;

  return (
    <div key={index} className={`node-field-line${isMissing ? ' missing' : ''}`}>
      {match[1]}
      <span className="node-field-key">{key}</span>
      <span className="node-field-colon">:</span>
      <span className="node-field-val">{value}</span>
    </div>
  );
}
