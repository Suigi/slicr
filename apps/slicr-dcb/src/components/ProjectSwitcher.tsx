import {useEffect, useRef, useState} from 'react';
import {FontAwesomeIcon} from '@fortawesome/react-fontawesome';
import {faCheck, faEdit} from '@fortawesome/free-solid-svg-icons';

export type Project = {
  id: string;
  name: string;
};

type ProjectSwitcherProps = {
  projects: Project[];
  activeProjectId: string;
  onSelectProject: (projectId: string) => void;
  onAddProject?: (name: string) => void | Promise<void>;
  onRenameProject?: (projectId: string, name: string) => void | Promise<void>;
};

export function ProjectSwitcher({projects, activeProjectId, onSelectProject, onAddProject, onRenameProject}: ProjectSwitcherProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [isCreatingProject, setIsCreatingProject] = useState(false);
  const [projectToRename, setProjectToRename] = useState<{ projectId: string, newName: string } | null>(null);
  const [projectName, setProjectName] = useState('New Project');
  const wrapRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const renameInputRef = useRef<HTMLInputElement>(null);
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
    if (!projectToRename) {
      return;
    }

    renameInputRef.current?.focus();
    renameInputRef.current?.select();
  }, [projectToRename]);

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

  const startProjectRename = (projectId: string, projectName: string) => {
    setProjectToRename({projectId, newName: projectName});
  }

  const closeProjectRename = () => {
    setProjectToRename(null);
  };

  const submitProjectRename = () => {
    if (!projectToRename) {
      return;
    }

    const nextProjectName = projectToRename.newName.trim();
    closeProjectRename();
    if (nextProjectName) {
      void onRenameProject?.(projectToRename.projectId, nextProjectName);
    }
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
            if (projectToRename && project.id === projectToRename.projectId) {
              return (
                <div className="project-switcher-item project-switcher-option project-switcher-inline-rename" role="option"
                     key={`project-switcher-item${project.id}`}
                     aria-selected="false">
                  <input
                    ref={renameInputRef}
                    type="text"
                    className="project-switcher-option-rename-input"
                    value={projectToRename.newName}
                    onChange={(event) => setProjectToRename({projectId: project.id, newName: event.target.value})}
                    onBlur={closeProjectRename}
                    onKeyDown={(event) => {
                      if (event.key === 'Enter') {
                        event.preventDefault();
                        submitProjectRename();
                      }
                    }}
                  />
                  <button
                    type="button"
                    className="project-switcher-option-rename-confirm chapter-sidebar-create-confirm"
                    aria-label="Rename project"
                    onMouseDown={(event) => event.preventDefault()}
                    onClick={submitProjectRename}
                  >
                    <FontAwesomeIcon icon={faCheck}/>
                  </button>
                </div>
              );
            } else {
              const isSelected = project.id === activeProjectId;
              return (
                <div
                  key={`project-switcher-item${project.id}`}
                  className={`project-switcher-item${isSelected ? ' project-switcher-item-selected' : ''}`}>
                  <button
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
                  <button
                    className={'project-switcher-rename-button'}
                    type="button"
                    onClick={() => startProjectRename(project.id, project.name)}
                  >
                    <FontAwesomeIcon icon={faEdit}/>
                  </button>
                </div>
              );
            }
          })}
          <div className="project-switcher-separator" aria-hidden="true"/>
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
                <FontAwesomeIcon icon={faCheck}/>
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
