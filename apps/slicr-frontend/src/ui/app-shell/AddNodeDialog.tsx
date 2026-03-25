import { useEffect, useMemo, useRef, useState } from 'react';
import { buildAddNodeDsl, type AddNodeType } from '../../application/addNodeDsl';
import type { Parsed, VisualNode } from '../../domain/types';
import { DataKeyChecklist, type DataChecklistRow } from './dialogs/DataKeyChecklist';
import { DialogFrame } from './dialogs/DialogFrame';
import { NodeSearchCombobox } from './dialogs/NodeSearchCombobox';
import { colorClassForNodeType, flattenDataKeysWithValue, kebabToTitle, selectAllInputText, stringifyValue } from './dialogs/dialogShared';

type AddNodeDialogProps = {
  parsed: Parsed | null;
  onCancel: () => void;
  onSubmit: (args: { dslBlock: string; insertionHint?: { preferCursor: boolean } }) => void;
};

type TypeOption = {
  value: AddNodeType;
  colorClass: string;
};

type IncomingCollection = {
  id: string;
  name: string;
  selectedRowIds: string[];
};

const TYPE_OPTIONS: TypeOption[] = [
  { value: 'generic', colorClass: 'type-generic' },
  { value: 'event', colorClass: 'type-event' },
  { value: 'read-model', colorClass: 'type-read-model' },
  { value: 'ui', colorClass: 'type-ui' },
  { value: 'command', colorClass: 'type-command' },
  { value: 'exception', colorClass: 'type-exception' },
  { value: 'automation', colorClass: 'type-automation' },
  { value: 'external', colorClass: 'type-external' }
];

function nodeRef(node: VisualNode): string {
  return node.type === 'generic' ? node.name : `${node.type}:${node.name}`;
}

function incomingRowIdsForNode(node: VisualNode): string[] {
  const ref = nodeRef(node);
  return flattenDataKeysWithValue(node.data).map((entry) => `${ref}:${entry.key}`);
}

function syntaxHighlightDsl(dsl: string): string {
  const escaped = dsl
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
  return escaped
    .replace(/"([^"\n]+)"/g, '<span class="dsl-string">"$1"</span>')
    .replace(/\b(rm|ui|cmd|evt|exc|aut|ext):([a-zA-Z0-9_#@.-]+)\b/g, '<span class="dsl-ref">$1:$2</span>')
    .replace(/(&lt;-|-&gt;)/g, '<span class="dsl-keyword">$1</span>')
    .replace(/\b(uses|data|collect)\b/g, '<span class="dsl-keyword">$1</span>');
}

export function AddNodeDialog({ parsed, onCancel, onSubmit }: AddNodeDialogProps) {
  const [typeInput, setTypeInput] = useState<AddNodeType>('event');
  const [typeQuery, setTypeQuery] = useState('event');
  const [typeActiveIndex, setTypeActiveIndex] = useState(-1);
  const [hideTypeSuggestionsUntilInput, setHideTypeSuggestionsUntilInput] = useState(false);

  const [name, setName] = useState('ticket-booked');
  const [alias, setAlias] = useState('Ticket Booked');
  const [aliasTouched, setAliasTouched] = useState(false);

  const [incomingQuery, setIncomingQuery] = useState('');
  const [selectedPredecessorRefs, setSelectedPredecessorRefs] = useState<string[]>([]);
  const [selectedIncomingRows, setSelectedIncomingRows] = useState<string[]>([]);
  const [collections, setCollections] = useState<IncomingCollection[]>([]);

  const typeInputRef = useRef<HTMLInputElement>(null);
  const nameInputRef = useRef<HTMLInputElement>(null);
  const focusNameAfterTypeBlurRef = useRef(false);
  const typeSuggestionsRef = useRef<HTMLDivElement>(null);
  const pendingCollectionFocusIdRef = useRef<string | null>(null);

  const candidateNodes = useMemo(() => {
    if (!parsed) return [];
    const scenarioOnly = new Set(parsed.scenarioOnlyNodeKeys);
    return [...parsed.nodes.values()].filter((node) => !scenarioOnly.has(node.key));
  }, [parsed]);

  const currentSelfRef = useMemo(() => {
    const prefix =
      typeInput === 'generic' ? ''
        : typeInput === 'event' ? 'evt'
          : typeInput === 'read-model' ? 'rm'
            : typeInput === 'command' ? 'cmd'
              : typeInput === 'exception' ? 'exc'
                : typeInput === 'automation' ? 'aut'
                  : typeInput === 'external' ? 'ext'
                    : 'ui';
    const trimmed = name.trim();
    if (!trimmed) return null;
    return prefix ? `${prefix}:${trimmed}` : trimmed;
  }, [typeInput, name]);

  const filteredIncomingNodes = useMemo(() => {
    const needle = incomingQuery.trim().toLowerCase();
    return candidateNodes
      .filter((node) => {
        const ref = nodeRef(node);
        if (selectedPredecessorRefs.includes(ref)) return false;
        if (currentSelfRef && ref === currentSelfRef) return false;
        if (!needle) return true;
        const haystack = `${ref} ${node.alias ?? ''} ${node.type}`.toLowerCase();
        return haystack.includes(needle);
      })
      .slice(0, 8);
  }, [candidateNodes, currentSelfRef, incomingQuery, selectedPredecessorRefs]);

  const selectedPredecessors = useMemo(() => {
    const byRef = new Map(candidateNodes.map((node) => [nodeRef(node), node]));
    return selectedPredecessorRefs.map((ref) => byRef.get(ref)).filter((node): node is VisualNode => Boolean(node));
  }, [candidateNodes, selectedPredecessorRefs]);

  const incomingRows = useMemo(() => {
    const rows: DataChecklistRow[] = [];
    for (const node of selectedPredecessors) {
      const ref = nodeRef(node);
      for (const entry of flattenDataKeysWithValue(node.data)) {
        rows.push({
          id: `${ref}:${entry.key}`,
          key: entry.key,
          value: stringifyValue(entry.value)
        });
      }
    }
    return rows;
  }, [selectedPredecessors]);

  const selectedUsesKeys = useMemo(() => {
    const rowsById = new Map(incomingRows.map((row) => [row.id, row]));
    return selectedIncomingRows.map((id) => rowsById.get(id)?.key).filter((key): key is string => Boolean(key));
  }, [incomingRows, selectedIncomingRows]);

  const collectionMappings = useMemo(() => {
    const rowsById = new Map(incomingRows.map((row) => [row.id, row]));
    return collections
      .map((collection) => ({
        name: collection.name,
        keys: collection.selectedRowIds
          .map((rowId) => rowsById.get(rowId)?.key)
          .filter((key): key is string => Boolean(key))
      }))
      .filter((collection) => collection.name.trim().length > 0 && collection.keys.length > 0);
  }, [collections, incomingRows]);

  const previewDsl = useMemo(() => buildAddNodeDsl({
    type: typeInput,
    name: name.trim() || 'new-node',
    alias: alias.trim(),
    predecessors: selectedPredecessorRefs,
    usesKeys: selectedUsesKeys,
    collections: collectionMappings
  }), [alias, collectionMappings, name, selectedPredecessorRefs, selectedUsesKeys, typeInput]);

  const filteredTypeOptions = useMemo(() => {
    const needle = typeQuery.trim().toLowerCase();
    if (!needle) return TYPE_OPTIONS;
    const startsWith = TYPE_OPTIONS.filter((option) => option.value.startsWith(needle));
    const contains = TYPE_OPTIONS.filter((option) => !option.value.startsWith(needle) && option.value.includes(needle));
    return [...startsWith, ...contains];
  }, [typeQuery]);

  const typeColorClass = TYPE_OPTIONS.find((entry) => entry.value === typeInput)?.colorClass ?? '';

  const submitDialog = () => {
    onSubmit({
      dslBlock: previewDsl,
      insertionHint: { preferCursor: true }
    });
  };

  useEffect(() => {
    window.setTimeout(() => typeInputRef.current?.focus(), 0);
  }, []);

  const topTypeSuggestion = filteredTypeOptions[0] ?? TYPE_OPTIONS[0];

  const closeTypeSuggestions = () => {
    if (typeSuggestionsRef.current) {
      typeSuggestionsRef.current.style.display = 'none';
    }
  };

  const renderTypeSuggestionsVisible = () => {
    if (!typeSuggestionsRef.current) return;
    const shouldShow = document.activeElement === typeInputRef.current && !hideTypeSuggestionsUntilInput;
    typeSuggestionsRef.current.style.display = shouldShow ? 'block' : 'none';
  };

  const scrollTypeActiveIntoView = () => {
    if (!typeSuggestionsRef.current) return;
    const active = typeSuggestionsRef.current.querySelector('.add-node-dialog__suggestion.active');
    if (active) (active as HTMLElement).scrollIntoView({ block: 'nearest' });
  };

  const addIncomingNode = (node: VisualNode) => {
    const ref = nodeRef(node);
    setSelectedPredecessorRefs((current) => [...current, ref]);
    const rowIds = incomingRowIdsForNode(node);
    if (rowIds.length > 0) {
      setSelectedIncomingRows((current) => [...new Set([...current, ...rowIds])]);
    }
  };

  const addCollection = () => {
    const id = ('randomUUID' in crypto)
      ? crypto.randomUUID()
      : `collection-${Date.now()}-${Math.random().toString(16).slice(2)}`;
    setCollections((current) => [...current, { id, name: 'name', selectedRowIds: [] }]);
    pendingCollectionFocusIdRef.current = id;
  };

  useEffect(() => {
    if (!pendingCollectionFocusIdRef.current) return;
    const input = document.getElementById(`collection-name-${pendingCollectionFocusIdRef.current}`) as HTMLInputElement | null;
    if (!input) return;
    input.focus();
    input.setSelectionRange(0, input.value.length);
    pendingCollectionFocusIdRef.current = null;
  }, [collections]);

  return (
    <DialogFrame
      backdropClassName="add-node-dialog-backdrop"
      panelClassName="add-node-dialog"
      ariaLabel="Add node"
      onCancel={onCancel}
      onSubmitShortcut={submitDialog}
    >
        <h2>Add Node</h2>

        <div className="add-node-dialog__top-row">
          <div className="add-node-dialog__field add-node-dialog__type-picker">
            <label htmlFor="add-node-type">Type</label>
            <input
              ref={typeInputRef}
              id="add-node-type"
              className={`add-node-dialog__input ${typeColorClass}`}
              value={typeQuery}
              onChange={(event) => {
                setHideTypeSuggestionsUntilInput(false);
                setTypeQuery(event.target.value);
                setTypeActiveIndex(-1);
                renderTypeSuggestionsVisible();
              }}
              onFocus={(event) => {
                selectAllInputText(event);
                renderTypeSuggestionsVisible();
              }}
              onBlur={() => {
                setTypeInput(topTypeSuggestion.value);
                setTypeQuery(topTypeSuggestion.value);
                setTypeActiveIndex(-1);
                window.setTimeout(() => {
                  closeTypeSuggestions();
                  if (focusNameAfterTypeBlurRef.current) {
                    focusNameAfterTypeBlurRef.current = false;
                    nameInputRef.current?.focus();
                  }
                }, 60);
              }}
              onKeyDown={(event) => {
                if (event.key === 'Tab' && !event.shiftKey) {
                  focusNameAfterTypeBlurRef.current = true;
                  return;
                }
                if (event.key === 'ArrowDown') {
                  if (hideTypeSuggestionsUntilInput || filteredTypeOptions.length === 0) return;
                  event.preventDefault();
                  setTypeActiveIndex((current) => {
                    const next = (current + 1 + filteredTypeOptions.length) % filteredTypeOptions.length;
                    window.setTimeout(scrollTypeActiveIntoView, 0);
                    return next;
                  });
                  return;
                }
                if (event.key === 'ArrowUp') {
                  if (hideTypeSuggestionsUntilInput || filteredTypeOptions.length === 0) return;
                  event.preventDefault();
                  setTypeActiveIndex((current) => {
                    if (current < 0) {
                      window.setTimeout(scrollTypeActiveIntoView, 0);
                      return filteredTypeOptions.length - 1;
                    }
                    const next = (current - 1 + filteredTypeOptions.length) % filteredTypeOptions.length;
                    window.setTimeout(scrollTypeActiveIntoView, 0);
                    return next;
                  });
                  return;
                }
                if (event.key === 'Enter') {
                  if (hideTypeSuggestionsUntilInput || filteredTypeOptions.length === 0) return;
                  event.preventDefault();
                  const picked = filteredTypeOptions[typeActiveIndex >= 0 ? typeActiveIndex : 0];
                  setTypeInput(picked.value);
                  setTypeQuery(picked.value);
                  setTypeActiveIndex(-1);
                  setHideTypeSuggestionsUntilInput(true);
                  closeTypeSuggestions();
                  return;
                }
                if (event.key === 'Escape') {
                  event.preventDefault();
                  onCancel();
                }
              }}
              placeholder="Start typing a node type"
            />
            <div ref={typeSuggestionsRef} className="add-node-dialog__suggestions">
              {filteredTypeOptions.map((option, index) => (
                <button
                  key={option.value}
                  type="button"
                  className={`add-node-dialog__suggestion ${option.colorClass} ${index === typeActiveIndex ? 'active' : ''}`}
                  onMouseDown={(event) => {
                    event.preventDefault();
                    setTypeInput(option.value);
                    setTypeQuery(option.value);
                    setTypeActiveIndex(-1);
                    setHideTypeSuggestionsUntilInput(true);
                    closeTypeSuggestions();
                  }}
                >
                  {option.value}
                </button>
              ))}
            </div>
          </div>

          <div className="add-node-dialog__field">
            <label htmlFor="add-node-name">Name (kebab-case)</label>
            <input
              ref={nameInputRef}
              id="add-node-name"
              className="add-node-dialog__input"
              value={name}
              onFocus={selectAllInputText}
              onChange={(event) => {
                setName(event.target.value);
                if (!aliasTouched) setAlias(kebabToTitle(event.target.value));
              }}
            />
          </div>

          <div className="add-node-dialog__field">
            <label htmlFor="add-node-alias">Alias</label>
            <input
              id="add-node-alias"
              className="add-node-dialog__input"
              value={alias}
              onFocus={selectAllInputText}
              onChange={(event) => {
                setAliasTouched(true);
                setAlias(event.target.value);
              }}
            />
          </div>

          <button
            type="button"
            className="project-modal-button"
            onClick={() => {
              setAliasTouched(false);
              setAlias(kebabToTitle(name));
            }}
          >
            reset
          </button>
        </div>

        <div className="add-node-dialog__content">
          <section className="add-node-dialog__left">
            <div className="add-node-dialog__field add-node-dialog__incoming-picker">
              <label htmlFor="add-node-incoming">Incoming Nodes</label>
              <NodeSearchCombobox
                inputId="add-node-incoming"
                inputClassName="add-node-dialog__input"
                pickerClassName="add-node-dialog__incoming-picker"
                suggestionsClassName="add-node-dialog__suggestions"
                itemClassName="add-node-dialog__incoming-item"
                activeClassName="active"
                emptyClassName="add-node-dialog__empty"
                primaryClassName="add-node-dialog__incoming-main"
                secondaryClassName="add-node-dialog__incoming-meta"
                placeholder="Search by name, alias, or type"
                options={filteredIncomingNodes.map((node) => {
                  const ref = nodeRef(node);
                  const typeClass = colorClassForNodeType(node.type);
                  return {
                    id: ref,
                    primary: node.alias ?? node.name,
                    secondary: ref,
                    colorClassName: typeClass,
                    value: node
                  };
                })}
                query={incomingQuery}
                onQueryChange={setIncomingQuery}
                onPick={(option) => addIncomingNode(option.value)}
                onEscape={onCancel}
                selectAllOnFocus
              />
            </div>

            <div className="add-node-dialog__field">
              <div className="add-node-dialog__subheader">Selected Incoming Nodes</div>
              <div className="add-node-dialog__selected-list">
                {selectedPredecessors.length === 0 ? (
                  <div className="add-node-dialog__empty">No predecessors chosen.</div>
                ) : (
                  selectedPredecessors.map((node) => {
                    const ref = nodeRef(node);
                    const typeClass = colorClassForNodeType(node.type);
                    return (
                      <div key={ref} className="add-node-dialog__selected-item">
                        <div className={`add-node-dialog__incoming-main ${typeClass}`}>
                          <span>{node.alias ?? node.name}</span>
                          <button
                            type="button"
                            className="add-node-dialog__remove"
                            aria-label={`Remove ${ref}`}
                            onClick={() => {
                              setSelectedPredecessorRefs((current) => current.filter((item) => item !== ref));
                              setSelectedIncomingRows((current) => current.filter((id) => !id.startsWith(`${ref}:`)));
                              setCollections((current) => current.map((collection) => ({
                                ...collection,
                                selectedRowIds: collection.selectedRowIds.filter((id) => !id.startsWith(`${ref}:`))
                              })));
                            }}
                          >
                            X
                          </button>
                        </div>
                        <div className={`add-node-dialog__incoming-meta ${typeClass}`}>{ref}</div>
                      </div>
                    );
                  })
                )}
              </div>
            </div>

            <div className="add-node-dialog__field">
              <div className="add-node-dialog__subheader-row">
                <div className="add-node-dialog__subheader">Incoming Data</div>
                <button type="button" className="project-modal-button" onClick={addCollection}>+ collection</button>
              </div>

              <DataKeyChecklist
                rows={incomingRows}
                selectedIds={selectedIncomingRows}
                onToggle={(rowId, checked) => {
                  if (checked) {
                    setSelectedIncomingRows((current) => [...current, rowId]);
                    return;
                  }
                  setSelectedIncomingRows((current) => current.filter((id) => id !== rowId));
                }}
                listClassName="add-node-dialog__rows"
                rowClassName="add-node-dialog__row"
                valueClassName="add-node-dialog__row-value"
                emptyClassName="add-node-dialog__empty"
                emptyText="Select incoming nodes to see data keys."
              />

              {collections.map((collection, index) => (
                <div key={collection.id} className="add-node-dialog__collection">
                  <div className="add-node-dialog__field">
                    <label htmlFor={`collection-name-${collection.id}`}>Collection Name</label>
                    <input
                      id={`collection-name-${collection.id}`}
                      className="add-node-dialog__input"
                      value={collection.name}
                      onFocus={selectAllInputText}
                      onChange={(event) => {
                        const next = event.target.value;
                        setCollections((current) => current.map((item) =>
                          item.id === collection.id ? { ...item, name: next } : item
                        ));
                      }}
                      placeholder={`collection-${index + 1}`}
                    />
                  </div>
                  <DataKeyChecklist
                    rows={incomingRows}
                    selectedIds={collection.selectedRowIds}
                    onToggle={(rowId, checked) => {
                      setCollections((current) => current.map((item) => {
                        if (item.id !== collection.id) return item;
                        if (checked) {
                          return { ...item, selectedRowIds: [...item.selectedRowIds, rowId] };
                        }
                        return { ...item, selectedRowIds: item.selectedRowIds.filter((id) => id !== rowId) };
                      }));
                    }}
                    listClassName="add-node-dialog__rows"
                    rowClassName="add-node-dialog__row"
                    valueClassName="add-node-dialog__row-value"
                    emptyClassName="add-node-dialog__empty"
                    emptyText="Select incoming nodes to see data keys."
                  />
                </div>
              ))}
            </div>
          </section>

          <section className="add-node-dialog__right">
            <h3>Preview</h3>
            <pre
              className="add-node-dialog__preview"
              dangerouslySetInnerHTML={{ __html: syntaxHighlightDsl(previewDsl) }}
            />
          </section>
        </div>

        <div className="project-modal-actions">
          <button type="button" className="project-modal-button" onClick={onCancel}>Cancel</button>
          <button type="button" className="project-modal-button primary" onClick={submitDialog}>Add Node</button>
        </div>
    </DialogFrame>
  );
}
