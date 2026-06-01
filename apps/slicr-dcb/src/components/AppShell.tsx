import type { ReactNode } from 'react';
import { SlicrIcon } from './SlicrIcon';

type AppShellProps = {
  projectSwitcher: ReactNode;
  sidebar: ReactNode;
  isSidebarOpen: boolean;
  onExpandSidebar: () => void;
  children: ReactNode;
};

export function AppShell({ projectSwitcher, sidebar, isSidebarOpen, onExpandSidebar, children }: AppShellProps) {
  return (
    <div className="app-shell">
      {isSidebarOpen ? (
        sidebar
      ) : (
        <aside className="collapsed-sidebar" aria-label="Collapsed navigation">
          <button type="button" className="collapsed-sidebar-app-button" onClick={onExpandSidebar} aria-label="Expand sidebar">
            <span className="app-brand-mark" aria-hidden="true">
              <SlicrIcon />
            </span>
          </button>
        </aside>
      )}
      <div className="app-content">
        <header className="app-topbar">
          {projectSwitcher}
          <div className="app-topbar-spacer" />
        </header>
        <main className="app-main">{children}</main>
      </div>
    </div>
  );
}
