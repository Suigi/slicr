import { DialogFrame } from './dialogs/DialogFrame';
import { analyzeEventCompaction, type CompactionPlan } from '../../eventCompaction';

type CompactEventsDialogProps = {
  onCancel: () => void;
  onCompact: (plan: CompactionPlan) => void;
};

export function CompactEventsDialog({ onCancel, onCompact }: CompactEventsDialogProps) {
  const preview = analyzeEventCompaction(localStorage);
  return (
    <DialogFrame
      backdropClassName="project-modal-backdrop"
      panelClassName="project-modal compact-events-dialog"
      ariaLabel="Compact event streams"
      onCancel={onCancel}
    >
      <h2>Compact Event Streams</h2>
      <p>Before bytes: {preview.beforeBytes}</p>
      <p>After bytes: {preview.afterBytes}</p>
      <p>Reclaimed bytes: {preview.reclaimedBytes}</p>
      <p>Keys to remove: {preview.plan.remove.length}</p>
      <div className="project-modal-actions">
        <button type="button" className="project-modal-button" onClick={onCancel}>Cancel</button>
        <button type="button" className="project-modal-button primary" onClick={() => onCompact(preview.plan)}>Compact</button>
      </div>
    </DialogFrame>
  );
}
