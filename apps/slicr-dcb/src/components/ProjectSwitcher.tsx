type ProjectSwitcherProps = {
  projectName: string;
};

export function ProjectSwitcher({ projectName }: ProjectSwitcherProps) {
  return (
    <button type="button" className="project-switcher" aria-label={`Current project: ${projectName}`}>
      <span className="project-switcher-name">{projectName}</span>
      <span className="project-switcher-chevron" aria-hidden="true">
        ▾
      </span>
    </button>
  );
}
