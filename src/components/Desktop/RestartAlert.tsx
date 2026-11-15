// React
import React, { useEffect, useId, useRef } from 'react';

/**
 * "Are you sure you want to restart your computer now?", as Mac OS X asked
 * it: a small alert over the dimmed desktop, Restart as the blue default.
 * Cancel holds the focus, as the safe choice (like Preferences' Restore
 * Defaults sheet); Escape cancels, and Tab stays on the two buttons.
 */
const RestartAlert: React.FC<{ onCancel: () => void; onRestart: () => void }> = ({ onCancel, onRestart }) => {
  const cancel = useRef<HTMLButtonElement>(null);
  const restart = useRef<HTMLButtonElement>(null);
  const id = useId();

  useEffect(() => {
    const previous = document.activeElement as HTMLElement | null;
    cancel.current?.focus();
    return () => previous?.focus?.();
  }, []);

  const onKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Escape') {
      e.preventDefault();
      onCancel();
    } else if (e.key === 'Tab') {
      e.preventDefault();
      (document.activeElement === cancel.current ? restart : cancel).current?.focus();
    }
  };

  return (
    <div className="desktop-alert-backdrop">
      <div
        className="desktop-alert"
        role="alertdialog"
        aria-modal="true"
        aria-labelledby={`${id}-title`}
        aria-describedby={`${id}-text`}
        onKeyDown={onKeyDown}
      >
        <img className="desktop-alert-icon" src="/macintosh-favicon.png" alt="" />
        <div className="desktop-alert-body">
          <p id={`${id}-title`} className="desktop-alert-title">Are you sure you want to restart your computer now?</p>
          <p id={`${id}-text`} className="desktop-alert-text">Open windows will close. Your settings stay.</p>
          <div className="desktop-alert-buttons">
            <button ref={cancel} onClick={onCancel}>Cancel</button>
            <button ref={restart} className="mac-button-primary" onClick={onRestart}>Restart</button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default RestartAlert;
