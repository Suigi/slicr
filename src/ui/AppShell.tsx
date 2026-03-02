import { DocumentationPanel } from '../DocumentationPanel';
import { NodeCard } from '../NodeCard';
import type { AppShellProps } from '../application/appViewModel';

export function AppShell(props: AppShellProps) {
  const {
    TYPE_LABEL,
    NODE_VERSION_SUFFIX,
    formatNodeData,
    MISSING_DATA_VALUE,
    getAmbiguousSourceCandidates,
    formatTraceSource,
    parsed,
    currentDsl,
    errorText,
    currentSliceName,
    library,
    theme,
    editorOpen,
    docsOpen,
    hasOpenedDocs,
    routeMode,
    routeMenuOpen,
    sliceMenuOpen,
    mobileMenuOpen,
    selectedNode,
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
    commandPaletteOpen,
    crossSliceDataExpandedKeys,
    crossSliceTraceExpandedKeys,
    sourceOverrides,
    pendingFocusNodeKeyRef,
    sceneModel,
    DiagramRenderer,
    diagramRendererId,
    rendererViewportKey,
    initialCamera,
    dragTooltip,
    dragAndDropEnabled,
    isPanning,
    beginCanvasPan,
    beginNodeDrag,
    beginEdgeSegmentDrag,
    canvasPanelRef,
    showDevDiagramControls,
    hasManualLayoutOverrides,
    toggleRef,
    sliceMenuRef,
    routeMenuRef,
    mobileMenuRef,
    editorRef,
    editorMountRef,
    setLibrary,
    setTheme,
    setEditorOpen,
    setSliceMenuOpen,
    setRouteMode,
    setRouteMenuOpen,
    setMobileMenuOpen,
    setSelectedNodeKey,
    setHighlightRange,
    setHoveredEdgeKey,
    setSelectedNodePanelTab,
    setFocusRequestVersion,
    setCrossSliceDataExpandedKeys,
    setCrossSliceTraceExpandedKeys,
    setHoveredTraceNodeKey,
    setSourceOverrides,
    setCommandPaletteOpen,
    collapseAllDataRegions,
    collapseAllRegions,
    expandAllRegions,
    focusRange,
    applySelectedSliceOverrides,
    addNewSlice,
    selectSlice,
    getSliceNameFromDsl,
    printDiagramGeometry,
    resetManualLayout,
    toggleDocumentationPanel,
    NODE_MEASURE_NODE_CLASS
  } = props;

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
    <>
      <header>
        <h1>Slicer</h1>
        <div className="legend">
          <div className="legend-item">
            <div className="legend-dot" style={{ borderColor: 'var(--rm-border)', background: 'var(--rm-bg)' }} />
            <span style={{color: 'var(--rm)'}}>read model</span>
          </div>
          <div className="legend-item">
            <div className="legend-dot" style={{ borderColor: 'var(--ui-border)', background: 'var(--ui-bg)' }} />
            <span style={{color: 'var(--ui)'}}>ui</span>
          </div>
          <div className="legend-item">
            <div className="legend-dot" style={{ borderColor: 'var(--cmd-border)', background: 'var(--cmd-bg)' }} />
            <span style={{color: 'var(--cmd)'}}>command</span>
          </div>
          <div className="legend-item">
            <div className="legend-dot" style={{ borderColor: 'var(--evt-border)', background: 'var(--evt-bg)' }} />
            <span style={{color: 'var(--evt)'}}>event</span>
          </div>
        </div>
        <div className="slice-controls">
          <div className="slice-menu" ref={sliceMenuRef}>
            <button
              type="button"
              className="slice-select-toggle"
              aria-label="Select slice"
              title="Select slice"
              onClick={() => setSliceMenuOpen((current) => !current)}
            >
              <span className="slice-select-label">{currentSliceName}</span>
              <span aria-hidden="true">▾</span>
            </button>
            {sliceMenuOpen && (
              <div className="slice-menu-panel" role="menu" aria-label="Slice list">
                {library.slices.map((slice) => {
                  const sliceName = getSliceNameFromDsl(slice.dsl);
                  return (
                    <button
                      key={slice.id}
                      type="button"
                      role="menuitemradio"
                      aria-checked={library.selectedSliceId === slice.id}
                      className="slice-menu-item"
                      onClick={() => {
                        setSelectedNodeKey(null);
                        setHighlightRange(null);
                        setLibrary((currentLibrary) => {
                          const nextLibrary = selectSlice(currentLibrary, slice.id);
                          if (nextLibrary.selectedSliceId !== currentLibrary.selectedSliceId) {
                            applySelectedSliceOverrides(nextLibrary.selectedSliceId);
                          }
                          return nextLibrary;
                        });
                        setSliceMenuOpen(false);
                      }}
                    >
                      <span className="slice-menu-check" aria-hidden="true">
                        {library.selectedSliceId === slice.id ? '✓' : ''}
                      </span>
                      <span>{sliceName}</span>
                    </button>
                  );
                })}
              </div>
            )}
          </div>
          <button
            type="button"
            className="slice-new"
            aria-label="Create new slice"
            title="Create new slice"
            onClick={() => {
              setSelectedNodeKey(null);
              setHighlightRange(null);
              setLibrary((currentLibrary) => {
                const nextLibrary = addNewSlice(currentLibrary);
                applySelectedSliceOverrides(nextLibrary.selectedSliceId);
                return nextLibrary;
              });
            }}
          >
            <svg
              width="14"
              height="14"
              viewBox="0 0 16 16"
              fill="none"
              xmlns="http://www.w3.org/2000/svg"
              aria-hidden="true"
            >
              <path
                fillRule="evenodd"
                clipRule="evenodd"
                d="M9.5 1.1l3.4 3.5.1.4v2h-1V6H8V2H3v11h4v1H2.5l-.5-.5v-12l.5-.5h6.7l.3.1zM9 2v3h2.9L9 2zm4 14h-1v-3H9v-1h3V9h1v3h3v1h-3v3z"
                fill="currentColor"
              />
            </svg>
          </button>
        </div>
        <button
          type="button"
          className="theme-toggle desktop-only"
          aria-label={theme === 'dark' ? 'Switch to light theme' : 'Switch to dark theme'}
          title={theme === 'dark' ? 'Switch to light theme' : 'Switch to dark theme'}
          onClick={() => setTheme((current) => (current === 'dark' ? 'light' : 'dark'))}
        >
          {theme === 'dark' ? (
            <svg
              width="14"
              height="14"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <circle cx="12" cy="12" r="4" />
              <line x1="12" y1="2" x2="12" y2="5" />
              <line x1="12" y1="19" x2="12" y2="22" />
              <line x1="2" y1="12" x2="5" y2="12" />
              <line x1="19" y1="12" x2="22" y2="12" />
              <line x1="4.93" y1="4.93" x2="7.05" y2="7.05" />
              <line x1="16.95" y1="16.95" x2="19.07" y2="19.07" />
              <line x1="16.95" y1="7.05" x2="19.07" y2="4.93" />
              <line x1="4.93" y1="19.07" x2="7.05" y2="16.95" />
            </svg>
          ) : (
            <svg
              width="14"
              height="14"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <path d="M21 12.8A9 9 0 1 1 11.2 3a7 7 0 0 0 9.8 9.8z" />
            </svg>
          )}
        </button>

        <button
          ref={toggleRef}
          className="dsl-toggle"
          aria-label="Toggle DSL editor"
          onClick={() => setEditorOpen((value) => !value)}
          style={{
            color: editorOpen ? 'var(--text)' : undefined,
            borderColor: editorOpen ? 'var(--text)' : undefined
          }}
        >
          <svg
            width="14"
            height="14"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <polyline points="16 18 22 12 16 6" />
            <polyline points="8 6 2 12 8 18" />
          </svg>
          DSL
        </button>
        <button
          type="button"
          className="docs-toggle desktop-only"
          aria-label="Toggle documentation panel"
          onClick={toggleDocumentationPanel}
          style={{
            color: docsOpen ? 'var(--text)' : undefined,
            borderColor: docsOpen ? 'var(--text)' : undefined
          }}
        >
          <svg
            width="14"
            height="14"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20" />
            <path d="M4 4.5A2.5 2.5 0 0 1 6.5 7H20" />
            <path d="M6.5 7v10" />
          </svg>
          Docs
        </button>
        <div className="mobile-menu" ref={mobileMenuRef}>
          <button
            type="button"
            className="mobile-menu-toggle"
            aria-label="Open more actions"
            title="More actions"
            onClick={() => setMobileMenuOpen((current) => !current)}
            style={{
              color: mobileMenuOpen ? 'var(--text)' : undefined,
              borderColor: mobileMenuOpen ? 'var(--text)' : undefined
            }}
          >
            ⋯
          </button>
          {mobileMenuOpen && (
            <div className="mobile-menu-panel" role="menu" aria-label="More actions">
              <button
                type="button"
                role="menuitem"
                className="mobile-menu-item"
                onClick={() => {
                  setTheme((current) => (current === 'dark' ? 'light' : 'dark'));
                  setMobileMenuOpen(false);
                }}
              >
                Theme: {theme === 'dark' ? 'Dark' : 'Light'}
              </button>
              <button
                type="button"
                role="menuitem"
                className="mobile-menu-item"
                onClick={() => {
                  toggleDocumentationPanel();
                  setMobileMenuOpen(false);
                }}
              >
                {docsOpen ? 'Hide Docs' : 'Show Docs'}
              </button>
              {showDevDiagramControls && (
                <>
                  <button
                    type="button"
                    role="menuitemradio"
                    aria-checked={routeMode === 'elk'}
                    className="mobile-menu-item"
                    onClick={() => {
                      setRouteMode('elk');
                      setMobileMenuOpen(false);
                    }}
                  >
                    Render: ELK {routeMode === 'elk' ? '✓' : ''}
                  </button>
                  <button
                    type="button"
                    role="menuitemradio"
                    aria-checked={routeMode === 'classic'}
                    className="mobile-menu-item"
                    onClick={() => {
                      setRouteMode('classic');
                      setMobileMenuOpen(false);
                    }}
                  >
                    Render: Classic {routeMode === 'classic' ? '✓' : ''}
                  </button>
                  <button
                    type="button"
                    role="menuitem"
                    className="mobile-menu-item"
                    onClick={() => {
                      resetManualLayout();
                      setMobileMenuOpen(false);
                    }}
                  >
                    Reset positions
                  </button>
                  <button
                    type="button"
                    role="menuitem"
                    className="mobile-menu-item"
                    onClick={() => {
                      printDiagramGeometry();
                      setMobileMenuOpen(false);
                    }}
                  >
                    Geometry
                  </button>
                </>
              )}
            </div>
          )}
        </div>
        {showDevDiagramControls && (
          <>
            <div className="route-menu desktop-only" ref={routeMenuRef}>
              <button
                type="button"
                className={`route-toggle ${hasManualLayoutOverrides ? 'has-manual-layout-overrides' : ''}`}
                aria-label="Select render mode"
                title="Select render mode"
                onClick={() => setRouteMenuOpen((current) => !current)}
              >
                {routeMode === 'elk' ? 'ELK' : 'Classic'} ▾
              </button>
              {routeMenuOpen && (
                <div className="route-menu-panel" role="menu" aria-label="Render mode">
                  {(['classic', 'elk'] as const).map((mode) => (
                    <button
                      key={mode}
                      type="button"
                      role="menuitemradio"
                      aria-checked={routeMode === mode}
                      className="route-menu-item"
                      onClick={() => {
                        setRouteMode(mode);
                        setRouteMenuOpen(false);
                      }}
                    >
                      <span className="route-menu-check" aria-hidden="true">{routeMode === mode ? '✓' : ''}</span>
                      <span>{mode === 'elk' ? 'ELK' : 'Classic'}</span>
                    </button>
                  ))}
                  <div className="route-menu-separator" />
                  <button
                    type="button"
                    role="menuitem"
                    className="route-menu-item"
                    onClick={() => {
                      resetManualLayout();
                      setRouteMenuOpen(false);
                    }}
                  >
                    <span className="route-menu-check" aria-hidden="true">↺</span>
                    <span>Reset positions</span>
                  </button>
                </div>
              )}
            </div>
            <button
              type="button"
              className="route-toggle desktop-only"
              aria-label="Print diagram geometry"
              title="Print current node/edge geometry to console (and clipboard when available)"
              onClick={printDiagramGeometry}
            >
              Geometry
            </button>
          </>
        )}
      </header>

      {parsed && parsed.nodes.size > 0 && (
        <div className="node-measure-layer" aria-hidden="true">
          {[...parsed.nodes.values()].map((node) => {
            const nodePrefix = TYPE_LABEL[node.type] ?? node.type;
            return (
              <div
                key={`measure-${node.key}`}
                className={NODE_MEASURE_NODE_CLASS}
                data-node-key={node.key}
              >
                <div className="node-measure-header">
                  {nodePrefix ? <span className="node-measure-prefix">{nodePrefix}:</span> : null}
                  <span className="node-measure-title">{node.alias ?? node.name.replace(NODE_VERSION_SUFFIX, '')}</span>
                </div>
                {node.data && (
                  <div className="node-measure-fields">
                    {formatNodeData(node.data).map((field) => (
                      <div
                        key={`measure-${node.key}-${field.key}`}
                        className="node-measure-field"
                      >
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
      )}

      <div className="main">
        <div ref={editorRef} className={`editor-panel ${editorOpen ? 'open' : ''}`}>
          <div className="panel-label">
            <div className="panel-handle" />
            <span>DSL</span>
            <button
              type="button"
              className="panel-action"
              onClick={collapseAllDataRegions}
              aria-label="Collapse all data regions"
              title="Collapse data regions"
            >
              <svg
                className="panel-action-icon"
                viewBox="0 0 12 12"
                fill="none"
                aria-hidden="true"
              >
                <path d="M2.5 2.5 5 5M5 5V3.6M5 5H3.6M9.5 9.5 7 7M7 7V8.4M7 7H8.4M4.2 7.8 7.8 4.2" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
              data
            </button>
            <button
              type="button"
              className="panel-action"
              onClick={collapseAllRegions}
              aria-label="Collapse all regions"
              title="Collapse all regions"
            >
              <svg
                className="panel-action-icon"
                viewBox="0 0 12 12"
                fill="none"
                aria-hidden="true"
              >
                <path d="M2.5 2.5 5 5M5 5V3.6M5 5H3.6M9.5 9.5 7 7M7 7V8.4M7 7H8.4M4.2 7.8 7.8 4.2" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
              all
            </button>
            <button
              type="button"
              className="panel-action"
              onClick={expandAllRegions}
              aria-label="Expand all regions"
              title="Expand all regions"
            >
              <svg
                className="panel-action-icon"
                viewBox="0 0 12 12"
                fill="none"
                aria-hidden="true"
              >
                <path d="M5 5 2.5 2.5M2.5 2.5V3.9M2.5 2.5H3.9M7 7 9.5 9.5M9.5 9.5V8.1M9.5 9.5H8.1" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
              all
            </button>
          </div>
          <div ref={editorMountRef} className="dsl-editor" />
          {errorText && <div className="error-bar">{errorText}</div>}
        </div>

        <DiagramRenderer
          key={rendererViewportKey}
          sceneModel={sceneModel}
          canvasPanelRef={canvasPanelRef}
          isPanning={isPanning}
          docsOpen={docsOpen}
          dragTooltip={dragTooltip}
          dragAndDropEnabled={dragAndDropEnabled}
          routeMode={routeMode}
          beginCanvasPan={beginCanvasPan}
          beginNodeDrag={beginNodeDrag}
          beginEdgeSegmentDrag={beginEdgeSegmentDrag}
          onNodeHoverRange={setHighlightRange}
          onNodeSelect={setSelectedNodeKey}
          onNodeOpenInEditor={(nodeKey, range) => {
            setSelectedNodeKey(nodeKey);
            setEditorOpen(true);
            focusRange(range);
          }}
          onEdgeHover={setHoveredEdgeKey}
          initialCamera={initialCamera}
        />
        {selectedNode && (
          <aside className="cross-slice-usage-panel" aria-label="Cross-Slice Usage" style={{ overflowY: 'auto' }}>
            <div className="cross-slice-panel-tabs" role="tablist" aria-label="Node panel tabs">
              <button
                type="button"
                role="tab"
                aria-selected={selectedNodePanelTab === 'usage'}
                className={`cross-slice-panel-tab ${selectedNodePanelTab === 'usage' ? 'active' : ''}`}
                onClick={() => setSelectedNodePanelTab('usage')}
              >
                Cross-Slice Usage
              </button>
              {crossSliceDataEnabled && (
                <button
                  type="button"
                  role="tab"
                  aria-selected={selectedNodePanelTab === 'crossSliceData'}
                  className={`cross-slice-panel-tab ${selectedNodePanelTab === 'crossSliceData' ? 'active' : ''}`}
                  onClick={() => setSelectedNodePanelTab('crossSliceData')}
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
                  onClick={() => {
                    setSelectedNodePanelTab('trace');
                  }}
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
                          return (
                            <button
                              key={`${usage.sliceId}:${usage.nodeKey}`}
                              type="button"
                              className="cross-slice-usage-item"
                              data-slice-id={usage.sliceId}
                              onClick={() => {
                                setSelectedNodeKey(usage.nodeKey);
                                pendingFocusNodeKeyRef.current = usage.nodeKey;
                                setFocusRequestVersion((version) => version + 1);
                                setLibrary((currentLibrary) => {
                                  const nextLibrary = selectSlice(currentLibrary, usage.sliceId);
                                  if (nextLibrary.selectedSliceId !== currentLibrary.selectedSliceId) {
                                    applySelectedSliceOverrides(nextLibrary.selectedSliceId);
                                  }
                                  return nextLibrary;
                                });
                              }}
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
                                className="cross-slice-usage-node-card"
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
                        onClick={() => setCrossSliceDataExpandedKeys((current) => ({ ...current, [key]: !current[key] }))}
                      >
                        <span className="cross-slice-data-key-toggle-icon" aria-hidden="true">
                          <svg viewBox="0 0 12 12" width="10" height="10">
                            <rect
                              x="1.5"
                              y="1.5"
                              width="9"
                              height="9"
                              rx="1"
                              fill="none"
                              stroke="currentColor"
                              strokeWidth="1.2"
                            />
                            <path
                              fill="none"
                              stroke="currentColor"
                              strokeWidth="1.4"
                              strokeLinecap="round"
                              d="M4 6 L8 6"
                            />
                            {!isExpanded && (
                              <path
                                fill="none"
                                stroke="currentColor"
                                strokeWidth="1.4"
                                strokeLinecap="round"
                                d="M6 4 L6 8"
                              />
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
                            <div
                              key={`${selectedNode.key}:${key}:${valueEntry.sliceId}`}
                              className="cross-slice-data-value-item"
                            >
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
                        onClick={() =>
                          setCrossSliceTraceExpandedKeys((current) => ({ ...current, [traceKey]: !current[traceKey] }))}
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
                          {entries.length === 0 && (
                            <div className="cross-slice-trace-empty">No trace</div>
                          )}
                          {entries.map((entry) => (
                            <div key={`${selectedNodeAnalysisRef}:${traceKey}:${entry.nodeKey}`} className="cross-slice-trace-result">
                              {entries.length > 1 && (
                                <div className="cross-slice-trace-version">{entry.nodeKey}</div>
                              )}
                              <div className="cross-slice-trace-hops">
                                {!entry.result.contributors && entry.result.hops.map((hop, index) => (
                                  <div
                                    key={`${entry.nodeKey}:${hop.nodeKey}:${hop.key}:${index}`}
                                    className={`cross-slice-trace-hop ${parsed?.nodes.get(hop.nodeKey)?.type ?? 'generic'}`}
                                    onMouseOver={() => setHoveredTraceNodeKey(hop.nodeKey)}
                                    onMouseOut={() => setHoveredTraceNodeKey((current) => (current === hop.nodeKey ? null : current))}
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
                                        onMouseOver={() => setHoveredTraceNodeKey(hop.nodeKey)}
                                        onMouseOut={() =>
                                          setHoveredTraceNodeKey((current) => (current === hop.nodeKey ? null : current))}
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
                                    <div
                                      key={`${issue.code}:${issue.nodeKey}:${issue.key}:${issue.range.from}`}
                                      className="cross-slice-trace-hop issue"
                                    >
                                      <span className="cross-slice-trace-issue-code">{issue.code}</span>
                                      {parsed && issue.code === 'ambiguous-source' && (
                                        <div className="cross-slice-issue-fixes">
                                          {getAmbiguousSourceCandidates(
                                            { dsl: currentDsl, nodes: parsed.nodes, edges: parsed.edges, sourceOverrides },
                                            issue.nodeKey,
                                            issue.key
                                          ).map((candidate) => (
                                            <button
                                              key={`${issue.nodeKey}:${issue.key}:${candidate}`}
                                              type="button"
                                              className="cross-slice-issue-fix"
                                              onClick={() =>
                                                setSourceOverrides((current) => ({
                                                  ...current,
                                                  [`${issue.nodeKey}:${issue.key}`]: candidate
                                                }))}
                                            >
                                              Use {candidate}
                                            </button>
                                          ))}
                                        </div>
                                      )}
                                    </div>
                                  ))}
                              </div>
                              {!selectedNodeIssues.some((issue) => (
                                issue.code === 'missing-source' && issue.key === traceKey && issue.nodeKey === entry.nodeKey
                              )) && (
                                <div className="cross-slice-trace-source">
                                  {formatTraceSource(entry.result.source)}
                                </div>
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
        )}
        {commandPaletteOpen && (
          <div className="command-palette" role="dialog" aria-label="Command palette">
            <button
              type="button"
              className="command-palette-item"
              onClick={() => {
                if (selectedNode && showDataTraceTab) {
                  const firstKey = selectedNodeUsesKeys[0] ?? null;
                  if (firstKey) {
                    setCrossSliceTraceExpandedKeys({ [firstKey]: true });
                  }
                  setSelectedNodePanelTab('trace');
                }
                setCommandPaletteOpen(false);
              }}
            >
              Trace data
            </button>
            <button
              type="button"
              className="command-palette-item"
              onClick={() => {
                setSelectedNodePanelTab('usage');
                setCommandPaletteOpen(false);
              }}
            >
              Show cross-slice usage
            </button>
          </div>
        )}
        {(hasOpenedDocs || docsOpen) && (
          <div className={`docs-panel-shell ${docsOpen ? '' : 'hidden'}`} aria-hidden={!docsOpen}>
            <DocumentationPanel diagramRendererId={diagramRendererId} />
          </div>
        )}
      </div>
    </>
  );
}
