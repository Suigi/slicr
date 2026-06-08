import type { NodeType } from '../graph/types';
import {FontAwesomeIcon} from '@fortawesome/react-fontawesome';
import {faTrash} from '@fortawesome/free-solid-svg-icons';

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
      <button type="button" role="menuitem" onClick={() => onSetType('dm')}>
        To <span className="node-menu-type-dm">Decision Model</span>
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
        <FontAwesomeIcon icon={faTrash} className={"node-menu-delete-icon"} />
        Delete
      </button>
    </div>
  );
}
