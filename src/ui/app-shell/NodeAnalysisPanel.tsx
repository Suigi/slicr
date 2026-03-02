import { NodeCard } from '../../NodeCard';
import { useAnalysisContext } from './contexts/AnalysisContext';

export function NodeAnalysisPanel() {
  const { analysisPanel, diagram, constants, actions } = useAnalysisContext();
  const {
    selectedNode,
    selectedSliceId,
    selectedNodePanelTab,
    selectedNodeAnalysisRef,
    selectedNodeAnalysisHeader,
    selectedNodeCrossSliceData,
    selectedNodeIssues,
    selectedNodeIssuesByKey,
    selectedNodeTraceResultsByKey,
    selectedNodeUsesKeys,
    missingSourceIssueKeys,
    crossSliceUsageGroups,
    crossSliceDataEnabled,
    showDataTraceTab,
    crossSliceDataExpandedKeys,
    crossSliceTraceExpandedKeys,
    sourceOverrides
  } = analysisPanel;
  const { TYPE_LABEL, formatTraceSource } = constants;
  const { parsed, currentDsl } = diagram;

  if (!selectedNode) {
    return null;
  }

  return (
    <aside className="cross-slice-usage-panel" aria-label="Cross-Slice Usage" style={{ overflowY: 'auto' }}>
      <div className="cross-slice-panel-tabs" role="tablist" aria-label="Node panel tabs">
        <button
          type="button"
          role="tab"
          aria-selected={selectedNodePanelTab === 'usage'}
          className={`cross-slice-panel-tab ${selectedNodePanelTab === 'usage' ? 'active' : ''}`}
          onClick={() => actions.onSelectedNodePanelTabChange('usage')}
        >
          Cross-Slice Usage
        </button>
        {crossSliceDataEnabled && (
          <button
            type="button"
            role="tab"
            aria-selected={selectedNodePanelTab === 'crossSliceData'}
            className={`cross-slice-panel-tab ${selectedNodePanelTab === 'crossSliceData' ? 'active' : ''}`}
            onClick={() => actions.onSelectedNodePanelTabChange('crossSliceData')}
          >
            Cross-Slice Data
          </button>
        )}
        {showDataTraceTab && (
          <button
            type="button"
            role="tab"
            aria-selected={selectedNodePanelTab === 'trace'}
            className={`cross-slice-panel-tab ${selectedNodePanelTab === 'trace' ? 'active' : ''} ${missingSourceIssueKeys.size > 0 ? 'has-missing-source' : ''}`}
            onClick={() => actions.onSelectedNodePanelTabChange('trace')}
          >
            Data Trace
          </button>
        )}
      </div>
      <div className="cross-slice-panel-divider" aria-hidden="true" />
      <div className={`cross-slice-usage-node ${selectedNodeAnalysisHeader.type}`.trim()}>
        {selectedNodeAnalysisHeader.type && (
          <span className="cross-slice-usage-node-type">{selectedNodeAnalysisHeader.type}:</span>
        )}
        <span className="cross-slice-usage-node-key">{selectedNodeAnalysisHeader.key}</span>
      </div>
      {selectedNodePanelTab === 'usage' && (
        <div className="cross-slice-usage-list">
          {crossSliceUsageGroups.map((group) => (
            <section key={group.sliceId} className="cross-slice-usage-group">
              <div className="cross-slice-usage-group-title">{group.sliceName}</div>
              <div className="cross-slice-usage-group-items">
                <div className="cross-slice-usage-group-frame">
                  {group.entries.map(({ usage, node }) => {
                    const nodeType = node?.type ?? '';
                    const nodePrefix = TYPE_LABEL[nodeType] ?? nodeType;
                    const isSelectedUsageNode = usage.sliceId === selectedSliceId && usage.nodeKey === selectedNode.key;
                    return (
                      <button
                        key={`${usage.sliceId}:${usage.nodeKey}`}
                        type="button"
                        className="cross-slice-usage-item"
                        data-slice-id={usage.sliceId}
                        onClick={() => actions.onJumpToUsage(usage.sliceId, usage.nodeKey)}
                      >
                        <NodeCard
                          node={node ?? {
                            type: 'generic',
                            name: usage.nodeKey,
                            alias: null,
                            stream: null,
                            key: usage.nodeKey,
                            data: null,
                            srcRange: { from: 0, to: 0 }
                          }}
                          nodePrefix={nodePrefix}
                          className={`cross-slice-usage-node-card ${isSelectedUsageNode ? 'selected' : ''}`.trim()}
                          maxFields={2}
                        />
                      </button>
                    );
                  })}
                </div>
              </div>
            </section>
          ))}
        </div>
      )}
      {crossSliceDataEnabled && selectedNodePanelTab === 'crossSliceData' && (
        <div className="cross-slice-data-list">
          {selectedNodeCrossSliceData.keys.map((key) => {
            const isExpanded = Boolean(crossSliceDataExpandedKeys[key]);
            return (
              <div key={`${selectedNodeAnalysisRef}:${key}`} className="cross-slice-data-key-section">
                <button
                  type="button"
                  className="cross-slice-data-key-toggle"
                  aria-expanded={isExpanded ? 'true' : 'false'}
                  onClick={() => actions.onToggleCrossSliceDataExpanded(key)}
                >
                  <span className="cross-slice-data-key-toggle-icon" aria-hidden="true">
                    <svg viewBox="0 0 12 12" width="10" height="10">
                      <rect x="1.5" y="1.5" width="9" height="9" rx="1" fill="none" stroke="currentColor" strokeWidth="1.2" />
                      <path fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" d="M4 6 L8 6" />
                      {!isExpanded && (
                        <path fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" d="M6 4 L6 8" />
                      )}
                    </svg>
                  </span>
                  <span className="cross-slice-data-key-toggle-label">{key}</span>
                </button>
                {isExpanded && (
                  <div className="cross-slice-data-values">
                    {(selectedNodeCrossSliceData.byKey[key] ?? []).length === 0 && (
                      <div className="cross-slice-data-empty">No values</div>
                    )}
                    {(selectedNodeCrossSliceData.byKey[key] ?? []).map((valueEntry) => (
                      <div key={`${selectedNode.key}:${key}:${valueEntry.sliceId}`} className="cross-slice-data-value-item">
                        {valueEntry.sliceName}: {String(valueEntry.value)}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
      {showDataTraceTab && selectedNodePanelTab === 'trace' && (
        <div className="cross-slice-trace-list">
          {selectedNodeUsesKeys.map((traceKey) => {
            const isExpanded = Boolean(crossSliceTraceExpandedKeys[traceKey]);
            const entries = selectedNodeTraceResultsByKey[traceKey] ?? [];
            return (
              <div
                key={`${selectedNodeAnalysisRef}:${traceKey}`}
                className={`cross-slice-trace-key-section ${missingSourceIssueKeys.has(traceKey) ? 'missing-source' : ''}`}
              >
                <button
                  type="button"
                  className="cross-slice-trace-key-toggle"
                  aria-expanded={isExpanded ? 'true' : 'false'}
                  onClick={() => actions.onToggleCrossSliceTraceExpanded(traceKey)}
                >
                  <span className="cross-slice-trace-key-toggle-icon" aria-hidden="true">
                    <svg viewBox="0 0 12 12" width="10" height="10">
                      <rect x="1.5" y="1.5" width="9" height="9" rx="1" fill="none" stroke="currentColor" strokeWidth="1.2" />
                      <path fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" d="M4 6 L8 6" />
                      {!isExpanded && (
                        <path fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" d="M6 4 L6 8" />
                      )}
                    </svg>
                  </span>
                  <span className="cross-slice-trace-key-toggle-label">{traceKey}</span>
                </button>
                {isExpanded && (
                  <div className="cross-slice-trace-key-values">
                    {entries.length === 0 && <div className="cross-slice-trace-empty">No trace</div>}
                    {entries.map((entry) => (
                      <div key={`${selectedNodeAnalysisRef}:${traceKey}:${entry.nodeKey}`} className="cross-slice-trace-result">
                        {entries.length > 1 && <div className="cross-slice-trace-version">{entry.nodeKey}</div>}
                        <div className="cross-slice-trace-hops">
                          {!entry.result.contributors && entry.result.hops.map((hop, index) => (
                            <div
                              key={`${entry.nodeKey}:${hop.nodeKey}:${hop.key}:${index}`}
                              className={`cross-slice-trace-hop ${parsed?.nodes.get(hop.nodeKey)?.type ?? 'generic'}`}
                              onMouseOver={() => actions.onTraceNodeHover(hop.nodeKey)}
                              onMouseOut={() => actions.onTraceNodeHover((current) => (current === hop.nodeKey ? null : current))}
                            >
                              <span className="cross-slice-trace-hop-node">{hop.nodeKey}</span>
                              <span className="cross-slice-trace-hop-sep">.</span>
                              <span className="cross-slice-trace-hop-key">{hop.key}</span>
                            </div>
                          ))}
                          {entry.result.contributors?.map((contributor) => (
                            <div key={`${entry.nodeKey}:${contributor.label}`} className="cross-slice-trace-contributor">
                              <div className="cross-slice-trace-contributor-label">{contributor.label}</div>
                              {contributor.hops.map((hop, index) => (
                                <div
                                  key={`${entry.nodeKey}:${contributor.label}:${hop.nodeKey}:${hop.key}:${index}`}
                                  className={`cross-slice-trace-hop ${parsed?.nodes.get(hop.nodeKey)?.type ?? 'generic'}`}
                                  onMouseOver={() => actions.onTraceNodeHover(hop.nodeKey)}
                                  onMouseOut={() => actions.onTraceNodeHover((current) => (current === hop.nodeKey ? null : current))}
                                >
                                  <span className="cross-slice-trace-hop-node">{hop.nodeKey}</span>
                                  <span className="cross-slice-trace-hop-sep">.</span>
                                  <span className="cross-slice-trace-hop-key">{hop.key}</span>
                                </div>
                              ))}
                            </div>
                          ))}
                          {(selectedNodeIssuesByKey[traceKey] ?? [])
                            .filter((issue) => issue.nodeKey === entry.nodeKey)
                            .map((issue) => (
                              <div key={`${issue.code}:${issue.nodeKey}:${issue.key}:${issue.range.from}`} className="cross-slice-trace-hop issue">
                                <span className="cross-slice-trace-issue-code">{issue.code}</span>
                                {parsed && issue.code === 'ambiguous-source' && (
                                  <div className="cross-slice-issue-fixes">
                                    {constants.getAmbiguousSourceCandidates(
                                      { dsl: currentDsl, nodes: parsed.nodes, edges: parsed.edges, sourceOverrides },
                                      issue.nodeKey,
                                      issue.key
                                    ).map((candidate) => (
                                      <button
                                        key={`${issue.nodeKey}:${issue.key}:${candidate}`}
                                        type="button"
                                        className="cross-slice-issue-fix"
                                        onClick={() => actions.onSetSourceOverride(issue.nodeKey, issue.key, candidate)}
                                      >
                                        Use {candidate}
                                      </button>
                                    ))}
                                  </div>
                                )}
                              </div>
                            ))}
                        </div>
                        {!selectedNodeIssues.some((issue) => issue.code === 'missing-source' && issue.key === traceKey && issue.nodeKey === entry.nodeKey) && (
                          <div className="cross-slice-trace-source">{formatTraceSource(entry.result.source)}</div>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </aside>
  );
}
