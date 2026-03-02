import type { ActionsSection, AuxPanelsSection } from '../../application/appViewModel';

type CommandPaletteProps = {
  auxPanels: AuxPanelsSection;
  actions: ActionsSection;
};

export function CommandPalette({ auxPanels, actions }: CommandPaletteProps) {
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
    </div>
  );
}
