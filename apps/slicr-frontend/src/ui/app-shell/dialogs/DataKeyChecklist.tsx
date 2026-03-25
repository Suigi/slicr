export type DataChecklistRow = {
  id: string;
  key: string;
  value: string;
};

type DataKeyChecklistProps = {
  rows: DataChecklistRow[];
  selectedIds: string[];
  onToggle: (rowId: string, checked: boolean) => void;
  listClassName: string;
  rowClassName: string;
  valueClassName: string;
  emptyClassName: string;
  emptyText: string;
};

export function DataKeyChecklist(props: DataKeyChecklistProps) {
  const {
    rows,
    selectedIds,
    onToggle,
    listClassName,
    rowClassName,
    valueClassName,
    emptyClassName,
    emptyText
  } = props;

  return (
    <div className={listClassName}>
      {rows.length === 0 ? (
        <div className={emptyClassName}>{emptyText}</div>
      ) : (
        rows.map((row) => {
          const checked = selectedIds.includes(row.id);
          return (
            <label key={row.id} className={rowClassName}>
              <input
                type="checkbox"
                checked={checked}
                onChange={(event) => onToggle(row.id, event.target.checked)}
              />
              <span>{row.key}</span>
              <span className={valueClassName}>{row.value}</span>
            </label>
          );
        })
      )}
    </div>
  );
}
