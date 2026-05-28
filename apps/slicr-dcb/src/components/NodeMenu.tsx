import type { NodeType } from '../graph/types';

type ConnectionMenuItem = {
  id: string;
  directionLabel: 'to' | 'from';
  nodeLabel: string;
  nodeType: NodeType;
};

type NodeMenuProps = {
  label: string;
  connectionMenuItems: ConnectionMenuItem[];
  onSetType: (type: NodeType) => void;
  onStartConnection: () => void;
  onDeleteConnection: (edgeId: string) => void;
  onDelete: () => void;
};

export function NodeMenu({
  label,
  connectionMenuItems,
  onSetType,
  onStartConnection,
  onDeleteConnection,
  onDelete,
}: NodeMenuProps) {
  return (
    <div className="node-menu" role="menu" aria-label={`${label} options`}>
      <button type="button" role="menuitem" onClick={() => onSetType('ui')}>
        To <span className="node-menu-type-ui">UI</span>
      </button>
      <button type="button" role="menuitem" onClick={() => onSetType('cmd')}>
        To <span className="node-menu-type-cmd">Command</span>
      </button>
      <button type="button" role="menuitem" onClick={() => onSetType('evt')}>
        To <span className="node-menu-type-evt">Event</span>
      </button>
      <button type="button" role="menuitem" onClick={() => onSetType('rm')}>
        To <span className="node-menu-type-rm">Read Model</span>
      </button>
      <button type="button" role="menuitem" onClick={() => onSetType('processor')}>
        To <span className="node-menu-type-processor">Processor</span>
      </button>
      <div className="node-menu-separator" />
      <button type="button" role="menuitem" onClick={onStartConnection}>
        Connect from here <span className="node-menu-shortcut">C</span>
      </button>
      {connectionMenuItems.map((item) => (
        <button key={item.id} type="button" role="menuitem" onClick={() => onDeleteConnection(item.id)}>
          Disconnect {item.directionLabel}{' '}
          <span className={`node-menu-type-${item.nodeType}`}>{item.nodeLabel}</span>
        </button>
      ))}
      <div className="node-menu-separator" />
      <button type="button" role="menuitem" className="node-menu-delete" onClick={onDelete}>
        <svg className="node-menu-delete-icon" viewBox="0 0 448 512" aria-hidden="true" focusable="false">
          <path d="M296 64l-16-32H168l-16 32h144zm-184 0l19.2-38.4C139.3 9.4 155.9 0 173.9 0h100.2c18 0 34.6 9.4 42.7 25.6L336 64h80c17.7 0 32 14.3 32 32s-14.3 32-32 32h-16v304c0 44.2-35.8 80-80 80H128c-44.2 0-80-35.8-80-80V128H32C14.3 128 0 113.7 0 96s14.3-32 32-32h80zm0 64v304c0 8.8 7.2 16 16 16h192c8.8 0 16-7.2 16-16V128H112zm48 64c8.8 0 16 7.2 16 16v160c0 8.8-7.2 16-16 16s-16-7.2-16-16V208c0-8.8 7.2-16 16-16zm64 0c8.8 0 16 7.2 16 16v160c0 8.8-7.2 16-16 16s-16-7.2-16-16V208c0-8.8 7.2-16 16-16zm64 0c8.8 0 16 7.2 16 16v160c0 8.8-7.2 16-16 16s-16-7.2-16-16V208c0-8.8 7.2-16 16-16z" />
        </svg>
        Delete
      </button>
    </div>
  );
}
