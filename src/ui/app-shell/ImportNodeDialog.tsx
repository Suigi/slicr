import { useMemo, useState } from 'react';
import { buildImportNodeDsl } from '../../application/importNodeDsl';
import type { Parsed } from '../../domain/types';
import type { ParsedSliceProjection } from '../../domain/parsedSliceProjection';
import { DataKeyChecklist, type DataChecklistRow } from './dialogs/DataKeyChecklist';
import { DialogFrame } from './dialogs/DialogFrame';
import { NodeSearchCombobox, type NodeSearchOption } from './dialogs/NodeSearchCombobox';
import { colorClassForNodeType, flattenDataKeysWithValue, kebabToTitle, stringifyValue } from './dialogs/dialogShared';

type ImportNodeDialogProps = {
  parsedSliceProjectionList: ParsedSliceProjection<Parsed>[];
  targetSliceId: string;
  onCancel: () => void;
  onSubmit: (args: { dslBlock: string; insertionHint?: { preferCursor: boolean } }) => void;
};

type ImportNodeOptionValue = {
  ref: string;
  alias: string;
  dataRows: Array<DataChecklistRow & { rawValue: unknown }>;
};

function nodeRef(node: { type: string; name: string }): string {
  return node.type === 'generic' ? node.name : `${node.type}:${node.name}`;
}

function aliasForNode(node: { alias: string | null; name: string }): string {
  return node.alias?.trim() || kebabToTitle(node.name);
}

export function ImportNodeDialog({ parsedSliceProjectionList, targetSliceId, onCancel, onSubmit }: ImportNodeDialogProps) {
  const [query, setQuery] = useState('');
  const [alias, setAlias] = useState('');
  const [selectedNodeRef, setSelectedNodeRef] = useState<string>('');
  const [selectedDataRowIds, setSelectedDataRowIds] = useState<string[]>([]);

  const allOptions = useMemo(() => {
    const options: Array<NodeSearchOption<ImportNodeOptionValue>> = [];

    for (const sliceProjection of parsedSliceProjectionList) {
      if (sliceProjection.id === targetSliceId) {
        continue;
      }
      const scenarioOnlyKeys = new Set(sliceProjection.parsed.scenarioOnlyNodeKeys);
      const sliceName = sliceProjection.parsed.sliceName;
      for (const node of sliceProjection.parsed.nodes.values()) {
        if (scenarioOnlyKeys.has(node.key)) continue;
        const dataRows = flattenDataKeysWithValue(node.data).map((entry) => ({
          id: `${node.key}:${entry.key}`,
          key: entry.key,
          value: stringifyValue(entry.value),
          rawValue: entry.value
        }));
        options.push({
          id: `${sliceProjection.id}:${node.key}`,
          primary: aliasForNode(node),
          secondary: `${nodeRef(node)} · ${sliceName}`,
          colorClassName: colorClassForNodeType(node.type),
          value: {
            ref: nodeRef(node),
            alias: aliasForNode(node),
            dataRows
          }
        });
      }
    }

    return options;
  }, [parsedSliceProjectionList, targetSliceId]);

  const filteredOptions = useMemo(() => {
    const needle = query.trim().toLowerCase();
    if (!needle) return allOptions.slice(0, 8);
    return allOptions
      .filter((option) => {
        const haystack = `${option.primary} ${option.secondary}`.toLowerCase();
        return haystack.includes(needle);
      })
      .slice(0, 8);
  }, [allOptions, query]);

  const selectedOption = useMemo(
    () => allOptions.find((option) => option.value.ref === selectedNodeRef) ?? allOptions[0] ?? null,
    [allOptions, selectedNodeRef]
  );

  const previewDsl = useMemo(() => buildImportNodeDsl({
    sourceRef: selectedOption?.value.ref ?? 'evt:new-node',
    alias,
    dataRows: (selectedOption?.value.dataRows ?? []).map((row) => ({
      id: row.id,
      key: row.key,
      value: row.rawValue
    })),
    selectedRowIds: selectedDataRowIds
  }), [alias, selectedDataRowIds, selectedOption]);

  const submitDialog = () => {
    onSubmit({
      dslBlock: previewDsl,
      insertionHint: { preferCursor: true }
    });
  };

  return (
    <DialogFrame
      backdropClassName="import-node-dialog-backdrop"
      panelClassName="import-node-dialog"
      ariaLabel="Import node"
      onCancel={onCancel}
      onSubmitShortcut={submitDialog}
    >
      <h2>Import Node</h2>

      <div className="import-node-dialog__field">
        <label htmlFor="import-node-search">Find Node Across Slices</label>
        <NodeSearchCombobox
          inputId="import-node-search"
          inputClassName="add-node-dialog__input"
          pickerClassName="import-node-dialog__picker"
          suggestionsClassName="add-node-dialog__suggestions import-node-dialog__suggestions"
          itemClassName="add-node-dialog__incoming-item"
          activeClassName="active"
          emptyClassName="add-node-dialog__empty"
          primaryClassName="add-node-dialog__incoming-main"
          secondaryClassName="add-node-dialog__incoming-meta"
          placeholder="Search by alias, id, or slice"
          options={filteredOptions}
          query={query}
          onQueryChange={setQuery}
          onPick={(option) => {
            setSelectedNodeRef(option.value.ref);
            setAlias(option.value.alias);
            setSelectedDataRowIds(option.value.dataRows.map((row) => row.id));
          }}
          onEscape={onCancel}
          selectAllOnFocus
          autoFocus
        />
      </div>

      <div className="import-node-dialog__field">
        <label htmlFor="import-node-alias">Alias</label>
        <input
          id="import-node-alias"
          className="add-node-dialog__input"
          value={alias}
          onChange={(event) => setAlias(event.target.value)}
        />
      </div>

      <div className="import-node-dialog__field">
        <div className="add-node-dialog__subheader">Data Keys</div>
        <DataKeyChecklist
          rows={selectedOption?.value.dataRows ?? []}
          selectedIds={selectedDataRowIds}
          onToggle={(rowId, checked) => {
            if (checked) {
              setSelectedDataRowIds((current) => [...new Set([...current, rowId])]);
              return;
            }
            setSelectedDataRowIds((current) => current.filter((id) => id !== rowId));
          }}
          listClassName="add-node-dialog__rows"
          rowClassName="add-node-dialog__row import-node-dialog__data-row"
          valueClassName="add-node-dialog__row-value"
          emptyClassName="add-node-dialog__empty"
          emptyText="Selected node has no data keys."
        />
      </div>

      <pre className="import-node-dialog__preview">{previewDsl}</pre>

      <div className="project-modal-actions">
        <button type="button" className="project-modal-button" onClick={onCancel}>Cancel</button>
        <button type="button" className="project-modal-button primary" onClick={submitDialog}>Import Node</button>
      </div>

      <input type="hidden" value={targetSliceId} readOnly />
    </DialogFrame>
  );
}
