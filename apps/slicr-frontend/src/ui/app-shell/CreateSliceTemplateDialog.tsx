import { useEffect, useMemo, useRef, useState } from 'react';
import { buildSliceTemplateText } from '../../application/buildSliceTemplateText';
import { getSliceTemplateById, SLICE_TEMPLATES, type SliceTargetMode, type SliceTemplate, type SliceTemplateId } from '../../application/sliceTemplateCatalog';
import type { Parsed } from '../../domain/types';
import type { ParsedSliceProjection } from '../../domain/parsedSliceProjection';
import { DialogFrame } from './dialogs/DialogFrame';
import { colorClassForNodeType, kebabToTitle, selectAllInputText } from './dialogs/dialogShared';

type CreateSliceTemplateDialogProps = {
  parsedSliceProjectionList: ParsedSliceProjection<Parsed>[];
  targetSliceId: string;
  onCancel: () => void;
  onSubmit: (args: { targetMode: SliceTargetMode; text: string }) => void;
};

type NodeDraft = {
  type: 'ui' | 'cmd' | 'evt' | 'rm' | 'aut';
  name: string;
  alias: string;
  aliasTouched: boolean;
};

type EventSuggestion = {
  id: string;
  name: string;
  alias: string;
  secondary: string;
  colorClassName: string;
};

function nodeDraftsForTemplate(template: SliceTemplate): Record<string, NodeDraft> {
  const drafts: Record<string, NodeDraft> = {};
  for (const node of template.nodes) {
    drafts[node.slot] = {
      type: node.type,
      name: node.defaultName,
      alias: node.defaultAlias,
      aliasTouched: false
    };
  }
  return drafts;
}

function laneRowForType(type: string): number {
  if (type === 'ui' || type === 'aut' || type === 'ext' || type === 'generic') return 0;
  if (type === 'evt' || type === 'exc') return 2;
  return 1;
}

function templateNodeLayout(template: SliceTemplate) {
  const width = 244;
  const height = 96;
  const nodeWidth = 34;
  const nodeHeight = 16;
  const laneTopByRow = { 0: 10, 1: 38, 2: 66 };
  const xGap = 44;
  const flowNodes = template.nodes;
  const totalWidth = flowNodes.length > 0 ? nodeWidth + (flowNodes.length - 1) * xGap : nodeWidth;
  const startX = Math.max(8, Math.round((width - totalWidth) / 2));
  const bySlot: Record<string, { x: number; y: number }> = {};
  flowNodes.forEach((node, index) => {
    bySlot[node.slot] = {
      x: startX + index * xGap,
      y: laneTopByRow[laneRowForType(node.type) as 0 | 1 | 2]
    };
  });
  return { width, height, nodeWidth, nodeHeight, bySlot };
}

function edgePath(fromPos: { x: number; y: number }, toPos: { x: number; y: number }, width: number, height: number): string {
  const fromX = fromPos.x + width;
  const fromY = fromPos.y + height / 2;
  const toCenterY = toPos.y + height / 2;
  if (Math.abs(fromY - toCenterY) < 0.1) {
    const toX = toPos.x;
    return `M ${fromX} ${fromY} L ${toX} ${toCenterY}`;
  }
  const edgeGoesDown = toCenterY > fromY;
  const entryY = edgeGoesDown ? toPos.y : toPos.y + height;
  const entryX = toPos.x + width / 2;
  return `M ${fromX} ${fromY} L ${entryX} ${fromY} L ${entryX} ${entryY}`;
}

function TemplateMiniDiagram({ template }: { template: SliceTemplate }) {
  const layout = templateNodeLayout(template);
  const markerId = `miniArrow-${template.id}`;
  const bySlot = new Map(template.nodes.map((node) => [node.slot, node]));
  const edges = template.edges
    .map((edge, index) => {
      const fromPos = layout.bySlot[edge.fromSlot];
      const toPos = layout.bySlot[edge.toSlot];
      const toNode = bySlot.get(edge.toSlot);
      if (!fromPos || !toPos || !toNode) return null;
      const optional = edge.optional === 'state-change-read-model' && toNode.type === 'rm';
      return (
        <path
          key={`${edge.fromSlot}:${edge.toSlot}:${index}`}
          className={`slice-template-dialog__mini-edge${optional ? ' optional' : ''}`}
          d={edgePath(fromPos, toPos, layout.nodeWidth, layout.nodeHeight)}
          markerEnd={`url(#${markerId})`}
        />
      );
    })
    .filter(Boolean);

  return (
    <svg viewBox={`0 0 ${layout.width} ${layout.height}`} aria-hidden="true" focusable="false">
      <defs>
        <marker id={markerId} markerWidth="8" markerHeight="8" refX="6.5" refY="3.5" orient="auto">
          <path d="M 0 0 L 7 3.5 L 0 7 z" fill="#5f6b80" />
        </marker>
      </defs>
      {edges}
      {template.nodes.map((node) => {
        const pos = layout.bySlot[node.slot];
        const optional = node.type === 'rm' && template.id === 'state-change';
        if (!pos) return null;
        return (
          <g key={node.slot}>
            <rect
              className={`slice-template-dialog__mini-node ${node.type}${optional ? ' optional' : ''}`}
              x={pos.x}
              y={pos.y}
              rx="5"
              width={layout.nodeWidth}
              height={layout.nodeHeight}
            />
            <text
              className={`slice-template-dialog__mini-node-label ${node.type}`}
              x={pos.x + layout.nodeWidth / 2}
              y={pos.y + layout.nodeHeight / 2 + 0.3}
            >
              {node.type}
            </text>
          </g>
        );
      })}
    </svg>
  );
}

function aliasForEventName(name: string, fallbackAlias: string): string {
  const normalized = name.trim();
  if (!normalized) return fallbackAlias;
  return kebabToTitle(normalized);
}

export function CreateSliceTemplateDialog({
  parsedSliceProjectionList,
  targetSliceId,
  onCancel,
  onSubmit
}: CreateSliceTemplateDialogProps) {
  const [selectedTemplateId, setSelectedTemplateId] = useState<SliceTemplateId>('state-change');
  const [targetMode, setTargetMode] = useState<SliceTargetMode>('create-new');
  const [sliceName, setSliceName] = useState('Payment Fulfillment');
  const [includeReadModelInStateChange, setIncludeReadModelInStateChange] = useState(true);
  const [draftBySlot, setDraftBySlot] = useState<Record<string, NodeDraft>>(() => nodeDraftsForTemplate(getSliceTemplateById('state-change')));
  const [eventQueryBySlot, setEventQueryBySlot] = useState<Record<string, string>>({});
  const [activeEventSlot, setActiveEventSlot] = useState<string | null>(null);
  const [activeEventIndex, setActiveEventIndex] = useState(-1);
  const sliceNameInputRef = useRef<HTMLInputElement>(null);
  const activeTemplate = useMemo(() => getSliceTemplateById(selectedTemplateId), [selectedTemplateId]);

  const allEventSuggestions = useMemo(() => {
    const options: EventSuggestion[] = [];
    for (const projection of parsedSliceProjectionList) {
      if (projection.id === targetSliceId) {
        continue;
      }
      const scenarioOnly = new Set(projection.parsed.scenarioOnlyNodeKeys);
      for (const node of projection.parsed.nodes.values()) {
        if (scenarioOnly.has(node.key) || node.type !== 'evt') {
          continue;
        }
        const alias = node.alias?.trim() || kebabToTitle(node.name);
        options.push({
          id: `${projection.id}:${node.key}`,
          name: node.name,
          alias,
          secondary: `evt:${node.name} · ${projection.parsed.sliceName}`,
          colorClassName: colorClassForNodeType(node.type)
        });
      }
    }
    return options;
  }, [parsedSliceProjectionList, targetSliceId]);

  const filteredEventSuggestions = useMemo(() => {
    if (!activeEventSlot) return [];
    const needle = (eventQueryBySlot[activeEventSlot] ?? '').trim().toLowerCase();
    if (!needle) return allEventSuggestions.slice(0, 8);
    return allEventSuggestions
      .filter((option) => `${option.alias} ${option.secondary}`.toLowerCase().includes(needle))
      .slice(0, 8);
  }, [activeEventSlot, allEventSuggestions, eventQueryBySlot]);

  const previewText = useMemo(
    () =>
      buildSliceTemplateText({
        templateId: selectedTemplateId,
        targetMode,
        sliceName,
        includeReadModelInStateChange,
        nodes: draftBySlot
      }),
    [draftBySlot, includeReadModelInStateChange, selectedTemplateId, sliceName, targetMode]
  );

  const selectTemplate = (templateId: SliceTemplateId) => {
    const template = getSliceTemplateById(templateId);
    setSelectedTemplateId(templateId);
    setDraftBySlot(nodeDraftsForTemplate(template));
    setIncludeReadModelInStateChange(true);
    setEventQueryBySlot({});
    setActiveEventSlot(null);
    setActiveEventIndex(-1);
    window.setTimeout(() => sliceNameInputRef.current?.focus(), 0);
  };

  const updateNodeName = (slot: string, value: string) => {
    setDraftBySlot((current) => {
      const entry = current[slot];
      if (!entry) return current;
      const nextAlias = entry.aliasTouched ? entry.alias : aliasForEventName(value, entry.alias);
      return {
        ...current,
        [slot]: {
          ...entry,
          name: value,
          alias: nextAlias
        }
      };
    });
  };

  const updateNodeAlias = (slot: string, value: string) => {
    setDraftBySlot((current) => {
      const entry = current[slot];
      if (!entry) return current;
      return {
        ...current,
        [slot]: {
          ...entry,
          alias: value,
          aliasTouched: true
        }
      };
    });
  };

  const resetNodeAlias = (slot: string) => {
    setDraftBySlot((current) => {
      const entry = current[slot];
      if (!entry) return current;
      return {
        ...current,
        [slot]: {
          ...entry,
          alias: kebabToTitle(entry.name),
          aliasTouched: false
        }
      };
    });
  };

  const submitDialog = () => onSubmit({ targetMode, text: previewText });

  useEffect(() => {
    window.setTimeout(() => sliceNameInputRef.current?.focus(), 0);
  }, []);

  return (
    <DialogFrame
      backdropClassName="create-slice-template-dialog-backdrop"
      panelClassName="create-slice-template-dialog"
      ariaLabel="Apply slice template"
      onCancel={onCancel}
      onSubmitShortcut={submitDialog}
    >
      <h2>Apply Slice Template</h2>

      <div className="create-slice-template-dialog__content">
        <section className="create-slice-template-dialog__left">
          <div className="create-slice-template-dialog__field">
            <div className="create-slice-template-dialog__label">Template</div>
            <div className="create-slice-template-dialog__templates">
              {SLICE_TEMPLATES.map((template) => (
                <button
                  key={template.id}
                  type="button"
                  className={`create-slice-template-dialog__template ${template.id === selectedTemplateId ? 'active' : ''}`}
                  onClick={() => selectTemplate(template.id)}
                >
                  <div className="create-slice-template-dialog__template-title">{template.label}</div>
                  <div className="create-slice-template-dialog__template-canvas">
                    <TemplateMiniDiagram template={template} />
                  </div>
                </button>
              ))}
            </div>
          </div>

          <div className="create-slice-template-dialog__field">
            <div className="create-slice-template-dialog__label">Target</div>
            <div className="create-slice-template-dialog__mode-options">
              <label className="create-slice-template-dialog__mode-option">
                <input
                  id="slice-template-target-create-new"
                  type="radio"
                  name="slice-template-target-mode"
                  checked={targetMode === 'create-new'}
                  onChange={() => {
                    setTargetMode('create-new');
                    window.setTimeout(() => sliceNameInputRef.current?.focus(), 0);
                  }}
                />
                Create New Slice
              </label>
              <label className="create-slice-template-dialog__mode-option">
                <input
                  id="slice-template-target-add-current"
                  type="radio"
                  name="slice-template-target-mode"
                  checked={targetMode === 'add-current'}
                  onChange={() => setTargetMode('add-current')}
                />
                Add to Current Slice
              </label>
            </div>
          </div>

          {targetMode === 'create-new' && (
            <div className="create-slice-template-dialog__field">
              <label htmlFor="slice-template-slice-name" className="create-slice-template-dialog__label">Slice Name</label>
              <input
                ref={sliceNameInputRef}
                id="slice-template-slice-name"
                className="add-node-dialog__input"
                value={sliceName}
                onFocus={selectAllInputText}
                onChange={(event) => setSliceName(event.target.value)}
              />
            </div>
          )}

          {selectedTemplateId === 'state-change' && (
            <label className="create-slice-template-dialog__toggle">
              <input
                type="checkbox"
                checked={includeReadModelInStateChange}
                onChange={(event) => setIncludeReadModelInStateChange(event.target.checked)}
              />
              Include read-model node in State Change template
            </label>
          )}

          <div className="create-slice-template-dialog__field">
            <div className="create-slice-template-dialog__label">Templated Nodes</div>
            <table className="create-slice-template-dialog__table">
              <thead>
                <tr>
                  <th>Type</th>
                  <th>Name</th>
                  <th>Alias</th>
                </tr>
              </thead>
              <tbody>
                {activeTemplate.nodes
                  .filter((node) => includeReadModelInStateChange || selectedTemplateId !== 'state-change' || node.slot !== 'projection-rm')
                  .map((node) => {
                    const draft = draftBySlot[node.slot];
                    if (!draft) return null;
                    const isEvent = draft.type === 'evt';
                    const showEventSuggestions = activeEventSlot === node.slot;
                    return (
                      <tr key={node.slot}>
                        <td className="create-slice-template-dialog__type-cell">
                          <span className={`create-slice-template-dialog__type-chip ${draft.type}`}>{draft.type}</span>
                        </td>
                        <td>
                          <div className="create-slice-template-dialog__event-input-wrap">
                            <input
                              className="add-node-dialog__input"
                              data-role="node-name"
                              data-slot={node.slot}
                              value={draft.name}
                              onFocus={(event) => {
                                selectAllInputText(event);
                                if (isEvent) {
                                  setActiveEventSlot(node.slot);
                                  setActiveEventIndex(-1);
                                  setEventQueryBySlot((current) => ({ ...current, [node.slot]: draft.name }));
                                }
                              }}
                              onBlur={() => {
                                window.setTimeout(() => {
                                  setActiveEventSlot((current) => (current === node.slot ? null : current));
                                  setActiveEventIndex(-1);
                                }, 60);
                              }}
                              onChange={(event) => {
                                updateNodeName(node.slot, event.target.value);
                                if (isEvent) {
                                  setEventQueryBySlot((current) => ({ ...current, [node.slot]: event.target.value }));
                                  setActiveEventSlot(node.slot);
                                  setActiveEventIndex(-1);
                                }
                              }}
                              onKeyDown={(event) => {
                                if (!isEvent || activeEventSlot !== node.slot || filteredEventSuggestions.length === 0) return;
                                if (event.key === 'ArrowDown') {
                                  event.preventDefault();
                                  setActiveEventIndex((current) => (current + 1 + filteredEventSuggestions.length) % filteredEventSuggestions.length);
                                  return;
                                }
                                if (event.key === 'ArrowUp') {
                                  event.preventDefault();
                                  setActiveEventIndex((current) => {
                                    if (current < 0) return filteredEventSuggestions.length - 1;
                                    return (current - 1 + filteredEventSuggestions.length) % filteredEventSuggestions.length;
                                  });
                                  return;
                                }
                                if (event.key === 'Enter') {
                                  event.preventDefault();
                                  const picked = filteredEventSuggestions[activeEventIndex >= 0 ? activeEventIndex : 0];
                                  if (!picked) return;
                                  setDraftBySlot((current) => {
                                    const entry = current[node.slot];
                                    if (!entry) return current;
                                    return {
                                      ...current,
                                      [node.slot]: {
                                        ...entry,
                                        name: picked.name,
                                        alias: entry.aliasTouched ? entry.alias : picked.alias
                                      }
                                    };
                                  });
                                  setEventQueryBySlot((current) => ({ ...current, [node.slot]: '' }));
                                  setActiveEventSlot(null);
                                  setActiveEventIndex(-1);
                                }
                              }}
                            />
                            <div
                              className="slice-template-dialog__event-suggestions add-node-dialog__suggestions"
                              style={{ display: showEventSuggestions && isEvent ? 'block' : 'none' }}
                            >
                              {filteredEventSuggestions.length === 0 ? (
                                <div className="add-node-dialog__empty">No suggestions.</div>
                              ) : (
                                filteredEventSuggestions.map((option, index) => (
                                  <button
                                    key={option.id}
                                    type="button"
                                    className={`add-node-dialog__incoming-item ${index === activeEventIndex ? 'active' : ''}`}
                                    onMouseDown={(event) => {
                                      event.preventDefault();
                                      setDraftBySlot((current) => {
                                        const entry = current[node.slot];
                                        if (!entry) return current;
                                        return {
                                          ...current,
                                          [node.slot]: {
                                            ...entry,
                                            name: option.name,
                                            alias: entry.aliasTouched ? entry.alias : option.alias
                                          }
                                        };
                                      });
                                      setEventQueryBySlot((current) => ({ ...current, [node.slot]: '' }));
                                      setActiveEventSlot(null);
                                      setActiveEventIndex(-1);
                                    }}
                                  >
                                    <div className={`add-node-dialog__incoming-main ${option.colorClassName}`}>{option.alias}</div>
                                    <div className={`add-node-dialog__incoming-meta ${option.colorClassName}`}>{option.secondary}</div>
                                  </button>
                                ))
                              )}
                            </div>
                          </div>
                        </td>
                        <td>
                          <div className="create-slice-template-dialog__alias-cell">
                            <input
                              className="add-node-dialog__input"
                              data-role="node-alias"
                              data-slot={node.slot}
                              value={draft.alias}
                              onFocus={selectAllInputText}
                              onChange={(event) => updateNodeAlias(node.slot, event.target.value)}
                            />
                            <button
                              type="button"
                              className="project-modal-button"
                              onClick={() => resetNodeAlias(node.slot)}
                            >
                              reset
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
              </tbody>
            </table>
          </div>
        </section>

        <section className="create-slice-template-dialog__right">
          <h3>Generated Text Preview</h3>
          <pre className="create-slice-template-dialog__preview">{previewText}</pre>
        </section>
      </div>

      <div className="project-modal-actions">
        <button type="button" className="project-modal-button" onClick={onCancel}>Cancel</button>
        <button type="button" className="project-modal-button primary" onClick={submitDialog}>Apply Template</button>
      </div>
    </DialogFrame>
  );
}
