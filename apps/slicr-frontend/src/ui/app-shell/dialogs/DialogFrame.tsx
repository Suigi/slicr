import type { ReactNode } from 'react';

type DialogFrameProps = {
  backdropClassName: string;
  panelClassName: string;
  ariaLabel: string;
  onCancel: () => void;
  onSubmitShortcut?: () => void;
  children: ReactNode;
};

export function DialogFrame({
  backdropClassName,
  panelClassName,
  ariaLabel,
  onCancel,
  onSubmitShortcut,
  children
}: DialogFrameProps) {
  return (
    <div className={backdropClassName} role="presentation" onClick={onCancel}>
      <div
        className={panelClassName}
        role="dialog"
        aria-modal="true"
        aria-label={ariaLabel}
        onClick={(event) => event.stopPropagation()}
        onKeyDown={(event) => {
          if ((event.metaKey || event.ctrlKey) && event.key === 'Enter') {
            event.preventDefault();
            onSubmitShortcut?.();
          }
        }}
      >
        {children}
      </div>
    </div>
  );
}
