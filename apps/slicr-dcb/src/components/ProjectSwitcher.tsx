import {useEffect, useRef, useState} from 'react';
import {FontAwesomeIcon} from '@fortawesome/react-fontawesome';
import {faCheck} from '@fortawesome/free-solid-svg-icons';

export type Project = {
  id: string;
  name: string;
};

type ProjectSwitcherProps = {
  projects: Project[];
  activeProjectId: string;
  onSelectProject: (projectId: string) => void;
  onAddProject?: (name: string) => void | Promise<void>;
};

export function ProjectSwitcher({projects, activeProjectId, onSelectProject, onAddProject}: ProjectSwitcherProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [isCreatingProject, setIsCreatingProject] = useState(false);
  const [projectName, setProjectName] = useState('New Project');
  const wrapRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const activeProject = projects.find((project) => project.id === activeProjectId) ?? projects[0];
  const currentProjectName = activeProject?.name ?? 'Select project';

  useEffect(() => {
    if (!isCreatingProject) {
      return;
    }

    inputRef.current?.focus();
    inputRef.current?.select();
  }, [isCreatingProject]);

  useEffect(() => {
    if (!isOpen || isCreatingProject) {
      return;
    }

    const closeWhenPointerStartsOutside = (event: PointerEvent) => {
      if (event.target instanceof Node && !wrapRef.current?.contains(event.target)) {
        setIsOpen(false);
      }
    };

    document.addEventListener('pointerdown', closeWhenPointerStartsOutside);
    return () => document.removeEventListener('pointerdown', closeWhenPointerStartsOutside);
  }, [isCreatingProject, isOpen]);

  const closeProjectCreation = () => {
    setIsCreatingProject(false);
    setProjectName('New Project');
  };

  const submitProjectCreation = () => {
    const nextProjectName = projectName.trim() || 'New Project';
    setIsCreatingProject(false);
    setIsOpen(false);
    setProjectName('New Project');
    void onAddProject?.(nextProjectName);
  };

  const startProjectCreation = () => {
    setIsOpen(true);
    setIsCreatingProject(true);
    setProjectName('New Project');
  };

  return (
    <div
      ref={wrapRef}
      className="project-switcher-wrap"
      onBlur={(event) => {
        if (!event.currentTarget.contains(event.relatedTarget)) {
          setIsOpen(false);
        }
      }}
    >
      <button
        type="button"
        className={`project-switcher${isOpen ? ' project-switcher-open' : ''}`}
        aria-label={`Current project: ${currentProjectName}`}
        aria-expanded={isOpen}
        aria-haspopup="listbox"
        onClick={() => setIsOpen((current) => !current)}
      >
        <span className="project-switcher-name">{currentProjectName}</span>
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
          <div className="project-switcher-separator" aria-hidden="true" />
          {isCreatingProject ? (
            <div className="project-switcher-option project-switcher-inline-create" role="option" aria-selected="false">
              <input
                ref={inputRef}
                type="text"
                className="project-switcher-option-add-input"
                value={projectName}
                onChange={(event) => setProjectName(event.target.value)}
                onBlur={closeProjectCreation}
                onKeyDown={(event) => {
                  if (event.key === 'Enter') {
                    event.preventDefault();
                    submitProjectCreation();
                  }
                  if (event.key === 'Escape') {
                    event.preventDefault();
                    closeProjectCreation();
                  }
                }}
              />
              <button
                type="button"
                className="project-switcher-option-add-confirm chapter-sidebar-create-confirm"
                aria-label="Create project"
                onMouseDown={(event) => event.preventDefault()}
                onClick={submitProjectCreation}
              >
                <FontAwesomeIcon icon={faCheck} />
              </button>
            </div>
          ) : (
            <button
              type="button"
              className="project-switcher-option project-switcher-option-add"
              role="option"
              aria-selected="false"
              onMouseDown={(event) => event.preventDefault()}
              onClick={startProjectCreation}
            >
              Add new Project ...
            </button>
          )}
        </div>
      ) : null}
    </div>
  );
}
