import { useMemo, useState } from 'react';
import type { ActionsSection, HeaderSection } from '../../application/appViewModel';

type ProjectRailProps = {
  header: HeaderSection;
  actions: ActionsSection;
};

export function ProjectRail({ header, actions }: ProjectRailProps) {
  const { currentProjectName, library, getSliceNameFromDsl, projectIndex, selectedProjectId } = header;
  const [projectMenuOpen, setProjectMenuOpen] = useState(false);
  const [createModalOpen, setCreateModalOpen] = useState(false);
  const [newProjectName, setNewProjectName] = useState('');
  const currentProjectLabel = useMemo(() => currentProjectName || 'Default', [currentProjectName]);

  return (
    <aside className="project-rail" aria-label="Project rail">
      <div className="project-rail-header">
        <span className="project-rail-label">Project</span>
        <div className="project-menu project-menu-inline">
          <button
            type="button"
            className="project-select-toggle"
            aria-label="Select project"
            title="Select project"
            onClick={() => setProjectMenuOpen((open) => !open)}
          >
            <span className="project-select-label">{currentProjectLabel}</span>
            <span aria-hidden="true">▾</span>
          </button>
          {projectMenuOpen && (
            <div className="project-menu-panel" role="menu" aria-label="Project list">
              {projectIndex.projects.map((project) => (
                <button
                  key={project.id}
                  type="button"
                  role="menuitemradio"
                  aria-checked={selectedProjectId === project.id}
                  className="project-menu-item"
                  onClick={() => {
                    actions.onSwitchProject(project.id);
                    setProjectMenuOpen(false);
                  }}
                >
                  <span className="project-menu-check" aria-hidden="true">
                    {selectedProjectId === project.id ? '✓' : ''}
                  </span>
                  <span>{project.name}</span>
                </button>
              ))}
              <div className="project-menu-separator" />
              <button
                type="button"
                role="menuitem"
                className="project-menu-item"
                onClick={() => {
                  setProjectMenuOpen(false);
                  setCreateModalOpen(true);
                }}
              >
                <span className="project-menu-check" aria-hidden="true">+</span>
                <span>Create Project ...</span>
              </button>
            </div>
          )}
        </div>
      </div>
      <div className="project-rail-slices">
        {library.slices.map((slice) => (
          <button
            key={slice.id}
            type="button"
            className={`project-rail-slice-item ${library.selectedSliceId === slice.id ? 'active' : ''}`}
            onClick={() => actions.onSelectSlice(slice.id)}
          >
            {getSliceNameFromDsl(slice.dsl)}
          </button>
        ))}
      </div>
      {createModalOpen && (
        <div className="project-modal-backdrop" role="presentation" onClick={() => setCreateModalOpen(false)}>
          <div
            className="project-modal"
            role="dialog"
            aria-modal="true"
            aria-label="Create project"
            onClick={(event) => event.stopPropagation()}
          >
            <h2>Create Project</h2>
            <label htmlFor="project-name-input">Project name</label>
            <input
              id="project-name-input"
              className="project-modal-input"
              value={newProjectName}
              onChange={(event) => setNewProjectName(event.target.value)}
              autoFocus
            />
            <div className="project-modal-actions">
              <button type="button" className="project-modal-button" onClick={() => setCreateModalOpen(false)}>Cancel</button>
              <button
                type="button"
                className="project-modal-button primary"
                onClick={() => {
                  actions.onCreateProject(newProjectName);
                  setNewProjectName('');
                  setCreateModalOpen(false);
                }}
              >
                Create
              </button>
            </div>
          </div>
        </div>
      )}
    </aside>
  );
}
