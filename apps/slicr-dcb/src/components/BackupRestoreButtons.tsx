import {FontAwesomeIcon} from '@fortawesome/react-fontawesome';
import {faCloudArrowDown, faCloudArrowUp} from '@fortawesome/free-solid-svg-icons';

type BackupRestoreButtonsProps = {
  onBackup: () => void;
  onRestore: () => void;
};

export function BackupRestoreButtons({onBackup, onRestore}: BackupRestoreButtonsProps) {
  return (
    <>
      <button
        type="button"
        className="app-topbar-icon-button"
        title="Copy full event backup to clipboard"
        aria-label="Copy full event backup to clipboard"
        onClick={onBackup}
      >
        <FontAwesomeIcon icon={faCloudArrowDown} />
      </button>
      <button
        type="button"
        className="app-topbar-icon-button"
        title="Restore full event backup from clipboard"
        aria-label="Restore full event backup from clipboard"
        onClick={onRestore}
      >
        <FontAwesomeIcon icon={faCloudArrowUp} />
      </button>
    </>
  );
}
