import type { NodeType } from '../graph/types';

type ConnectionMenuItem = {
  id: string;
  label: string;
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
        To UI
      </button>
      <button type="button" role="menuitem" onClick={() => onSetType('cmd')}>
        To Command
      </button>
      <button type="button" role="menuitem" onClick={() => onSetType('evt')}>
        To Event
      </button>
      <button type="button" role="menuitem" onClick={() => onSetType('rm')}>
        To Read Model
      </button>
      <div className="node-menu-separator" />
      <button type="button" role="menuitem" onClick={onStartConnection}>
        Connect from here <span className="node-menu-shortcut">C</span>
      </button>
      {connectionMenuItems.length > 0 ? <div className="node-menu-separator" /> : null}
      {connectionMenuItems.map((item) => (
        <button key={item.id} type="button" role="menuitem" onClick={() => onDeleteConnection(item.id)}>
          Disconnect {item.label}
        </button>
      ))}
      <div className="node-menu-separator" />
      <button type="button" role="menuitem" className="node-menu-delete" onClick={onDelete}>
        🗑️ Delete
      </button>
    </div>
  );
}
