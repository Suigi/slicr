import { useState } from 'react';

export type Project = {
  id: string;
  name: string;
};

type ProjectSwitcherProps = {
  projects: Project[];
  activeProjectId: string;
  onSelectProject: (projectId: string) => void;
};

export function ProjectSwitcher({ projects, activeProjectId, onSelectProject }: ProjectSwitcherProps) {
  const [isOpen, setIsOpen] = useState(false);
  const activeProject = projects.find((project) => project.id === activeProjectId) ?? projects[0];
  const projectName = activeProject?.name ?? 'Select project';

  return (
    <div className="project-switcher-wrap" onBlur={() => setIsOpen(false)}>
      <button
        type="button"
        className={`project-switcher${isOpen ? ' project-switcher-open' : ''}`}
        aria-label={`Current project: ${projectName}`}
        aria-expanded={isOpen}
        aria-haspopup="listbox"
        onClick={() => setIsOpen((current) => !current)}
      >
        <span className="project-switcher-name">{projectName}</span>
        <svg className="project-switcher-chevron" viewBox="0 0 448 512" aria-hidden="true">
          <path
            fill="currentColor"
            d="M201.4 342.6c12.5 12.5 32.8 12.5 45.3 0l160-160c12.5-12.5 12.5-32.8 0-45.3s-32.8-12.5-45.3 0L224 274.7 86.6 137.4c-12.5-12.5-32.8-12.5-45.3 0s-12.5 32.8 0 45.3l160 160z"
          />
        </svg>
      </button>
      {isOpen ? (
        <div className="project-switcher-menu" role="listbox" aria-label="Projects">
          {projects.map((project) => {
            const isSelected = project.id === activeProjectId;
            return (
              <button
                key={project.id}
                type="button"
                className={`project-switcher-option${isSelected ? ' project-switcher-option-selected' : ''}`}
                role="option"
                aria-selected={isSelected}
                onMouseDown={(event) => event.preventDefault()}
                onClick={() => {
                  onSelectProject(project.id);
                  setIsOpen(false);
                }}
              >
                {project.name}
              </button>
            );
          })}
        </div>
      ) : null}
    </div>
  );
}
