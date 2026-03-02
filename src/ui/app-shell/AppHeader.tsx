import type { ActionsSection, HeaderSection, ThemeMode } from '../../application/appViewModel';

type AppHeaderProps = {
  header: HeaderSection;
  actions: ActionsSection;
  editorOpen: boolean;
};

function themeLabel(theme: ThemeMode): string {
  return theme === 'dark' ? 'Switch to light theme' : 'Switch to dark theme';
}

export function AppHeader({ header, actions, editorOpen }: AppHeaderProps) {
  const {
    currentSliceName,
    library,
    getSliceNameFromDsl,
    theme,
    docsOpen,
    routeMode,
    showDevDiagramControls,
    hasManualLayoutOverrides,
    sliceMenuOpen,
    routeMenuOpen,
    mobileMenuOpen,
    sliceMenuRef,
    routeMenuRef,
    mobileMenuRef,
    toggleRef
  } = header;

  return (
    <header>
      <h1>Slicer</h1>
      <div className="legend">
        <div className="legend-item">
          <div className="legend-dot" style={{ borderColor: 'var(--rm-border)', background: 'var(--rm-bg)' }} />
          <span style={{ color: 'var(--rm)' }}>read model</span>
        </div>
        <div className="legend-item">
          <div className="legend-dot" style={{ borderColor: 'var(--ui-border)', background: 'var(--ui-bg)' }} />
          <span style={{ color: 'var(--ui)' }}>ui</span>
        </div>
        <div className="legend-item">
          <div className="legend-dot" style={{ borderColor: 'var(--cmd-border)', background: 'var(--cmd-bg)' }} />
          <span style={{ color: 'var(--cmd)' }}>command</span>
        </div>
        <div className="legend-item">
          <div className="legend-dot" style={{ borderColor: 'var(--evt-border)', background: 'var(--evt-bg)' }} />
          <span style={{ color: 'var(--evt)' }}>event</span>
        </div>
      </div>
      <div className="slice-controls">
        <div className="slice-menu" ref={sliceMenuRef}>
          <button
            type="button"
            className="slice-select-toggle"
            aria-label="Select slice"
            title="Select slice"
            onClick={actions.onToggleSliceMenu}
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
                      actions.onSelectSlice(slice.id);
                      actions.onToggleSliceMenu();
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
          onClick={actions.onCreateSlice}
        >
          <svg width="14" height="14" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
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
        aria-label={themeLabel(theme)}
        title={themeLabel(theme)}
        onClick={actions.onToggleTheme}
      >
        {theme === 'dark' ? (
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
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
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M21 12.8A9 9 0 1 1 11.2 3a7 7 0 0 0 9.8 9.8z" />
          </svg>
        )}
      </button>

      <button
        ref={toggleRef}
        className="dsl-toggle"
        aria-label="Toggle DSL editor"
        onClick={actions.onToggleEditor}
        style={{
          color: editorOpen ? 'var(--text)' : undefined,
          borderColor: editorOpen ? 'var(--text)' : undefined
        }}
      >
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <polyline points="16 18 22 12 16 6" />
          <polyline points="8 6 2 12 8 18" />
        </svg>
        DSL
      </button>
      <button
        type="button"
        className="docs-toggle desktop-only"
        aria-label="Toggle documentation panel"
        onClick={actions.onToggleDocs}
        style={{
          color: docsOpen ? 'var(--text)' : undefined,
          borderColor: docsOpen ? 'var(--text)' : undefined
        }}
      >
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
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
          onClick={actions.onToggleMobileMenu}
          style={{
            color: mobileMenuOpen ? 'var(--text)' : undefined,
            borderColor: mobileMenuOpen ? 'var(--text)' : undefined
          }}
        >
          ⋯
        </button>
        {mobileMenuOpen && (
          <div className="mobile-menu-panel" role="menu" aria-label="More actions">
            <button type="button" role="menuitem" className="mobile-menu-item" onClick={() => { actions.onToggleTheme(); actions.onCloseMobileMenu(); }}>
              Theme: {theme === 'dark' ? 'Dark' : 'Light'}
            </button>
            <button type="button" role="menuitem" className="mobile-menu-item" onClick={() => { actions.onToggleDocs(); actions.onCloseMobileMenu(); }}>
              {docsOpen ? 'Hide Docs' : 'Show Docs'}
            </button>
            {showDevDiagramControls && (
              <>
                <button type="button" role="menuitemradio" aria-checked={routeMode === 'elk'} className="mobile-menu-item" onClick={() => { actions.onRouteModeChange('elk'); actions.onCloseMobileMenu(); }}>
                  Render: ELK {routeMode === 'elk' ? '✓' : ''}
                </button>
                <button type="button" role="menuitemradio" aria-checked={routeMode === 'classic'} className="mobile-menu-item" onClick={() => { actions.onRouteModeChange('classic'); actions.onCloseMobileMenu(); }}>
                  Render: Classic {routeMode === 'classic' ? '✓' : ''}
                </button>
                <button type="button" role="menuitem" className="mobile-menu-item" onClick={() => { actions.onResetManualLayout(); actions.onCloseMobileMenu(); }}>
                  Reset positions
                </button>
                <button type="button" role="menuitem" className="mobile-menu-item" onClick={() => { void actions.onPrintGeometry(); actions.onCloseMobileMenu(); }}>
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
              onClick={actions.onToggleRouteMenu}
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
                      actions.onRouteModeChange(mode);
                      actions.onToggleRouteMenu();
                    }}
                  >
                    <span className="route-menu-check" aria-hidden="true">{routeMode === mode ? '✓' : ''}</span>
                    <span>{mode === 'elk' ? 'ELK' : 'Classic'}</span>
                  </button>
                ))}
                <div className="route-menu-separator" />
                <button type="button" role="menuitem" className="route-menu-item" onClick={() => { actions.onResetManualLayout(); actions.onToggleRouteMenu(); }}>
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
            onClick={() => void actions.onPrintGeometry()}
          >
            Geometry
          </button>
        </>
      )}
    </header>
  );
}
