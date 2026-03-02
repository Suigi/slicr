import type { ActionsSection, AuxPanelsSection, HeaderSection } from '../../application/appViewModel';

type CommandPaletteProps = {
  auxPanels: AuxPanelsSection;
  actions: ActionsSection;
  header: HeaderSection;
};

export function CommandPalette({ auxPanels, actions, header }: CommandPaletteProps) {
  if (!auxPanels.commandPaletteOpen) {
    return null;
  }

  return (
    <div className="command-palette" role="dialog" aria-label="Command palette">
      <button type="button" className="command-palette-item" onClick={actions.onRunTraceCommand}>
        Trace data
      </button>
      <button type="button" className="command-palette-item" onClick={actions.onShowUsageCommand}>
        Show cross-slice usage
      </button>
      {header.projectIndex.projects
        .filter((project) => project.id !== header.selectedProjectId)
        .map((project) => (
          <button
            key={project.id}
            type="button"
            className="command-palette-item"
            onClick={() => actions.onSwitchProject(project.id)}
          >
            {`Switch Project: ${project.name}`}
          </button>
        ))}
    </div>
  );
}
