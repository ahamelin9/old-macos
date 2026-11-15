// React
import React, { useEffect, useId, useRef, useState } from 'react';
// Context
import { useSettings } from '../../../contexts/useSettings';
// Panes
import { AppearancePane, DateTimePane, DesktopPane, DockPane } from './panes';
// Styling
import './Preferences.css';

/** The panes, in the order the Show All grid lists them, by group as in Mac OS X */
const PANES = [
  { id: 'desktop', name: 'Desktop', group: 'Personal', Pane: DesktopPane },
  { id: 'appearance', name: 'Appearance', group: 'Personal', Pane: AppearancePane },
  { id: 'dock', name: 'Dock', group: 'Personal', Pane: DockPane },
  { id: 'datetime', name: 'Date & Time', group: 'System', Pane: DateTimePane }
] as const;

type PaneId = (typeof PANES)[number]['id'];

const GROUPS = [...new Set(PANES.map(p => p.group))];

interface PreferencesProps {
  /** Open at this pane ('dock' for the Apple menu's Dock Preferences…); Show All when missing or unknown */
  pane?: string;
  /** Changes with each request (launch.tsx), so an open window asked for the same pane again goes back to it */
  request?: number;
}

const paneFor = (id: string | undefined): PaneId | null => PANES.find(p => p.id === id)?.id ?? null;

/**
 * System Preferences, in the Mac OS X style: a grid of panes with icons;
 * clicking one opens it, and Show All goes back. Every choice applies at
 * once and is saved in this browser (SettingsContext).
 */
const Preferences: React.FC<PreferencesProps> = ({ pane: requestedPane, request }) => {
  const { settingsSaved } = useSettings();
  const [paneId, setPaneId] = useState<PaneId | null>(() => paneFor(requestedPane));
  const [confirming, setConfirming] = useState(false);
  // A new request while open (showApp) switches to its pane, as React's docs
  // advise for state that follows a prop: during render, not in an effect
  const [seenRequest, setSeenRequest] = useState(request);
  if (request !== seenRequest) {
    setSeenRequest(request);
    if (paneFor(requestedPane)) setPaneId(paneFor(requestedPane));
  }
  const pane = PANES.find(p => p.id === paneId);

  return (
    <div className="preferences-app">
      <div className="mac-toolbar preferences-toolbar">
        <button className="preferences-show-all" onClick={() => setPaneId(null)} disabled={!pane}>
          Show All
        </button>
        <h2 className="preferences-title">{pane ? pane.name : 'System Preferences'}</h2>
      </div>

      <div className="preferences-body">
        {pane ? (
          <pane.Pane />
        ) : (
          <div className="preferences-grid">
            {GROUPS.map(group => (
              <section className="preferences-group" key={group}>
                <h3 className="preferences-group-name">{group}</h3>
                <div className="preferences-group-panes">
                  {PANES.filter(p => p.group === group).map(p => (
                    <button key={p.id} className="preferences-pane-button" onClick={() => setPaneId(p.id)}>
                      <span className={`preferences-icon preferences-icon-${p.id}`} aria-hidden="true" />
                      <span className="preferences-pane-name">{p.name}</span>
                    </button>
                  ))}
                </div>
              </section>
            ))}
            <div className="preferences-footer">
              <button onClick={() => setConfirming(true)}>Restore Defaults…</button>
            </div>
          </div>
        )}
        {!settingsSaved && (
          <p className="preferences-note preferences-warning">
            This browser won't keep settings (a private window?), so these last only this visit.
          </p>
        )}
      </div>

      {confirming && <RestoreSheet onDone={() => setConfirming(false)} />}
    </div>
  );
};

/** The "are you sure?" sheet, dropping from the top of the window as in Mac OS X */
const RestoreSheet: React.FC<{ onDone: () => void }> = ({ onDone }) => {
  const { restoreDefaults } = useSettings();
  const cancel = useRef<HTMLButtonElement>(null);
  const id = useId();

  // Cancel is the safe choice, so it has the focus
  useEffect(() => cancel.current?.focus(), []);

  return (
    <div className="preferences-sheet-backdrop">
      <div
        className="preferences-sheet"
        role="alertdialog"
        aria-modal="true"
        aria-labelledby={`${id}-title`}
        aria-describedby={`${id}-text`}
        onKeyDown={e => { if (e.key === 'Escape') onDone(); }}
      >
        <p id={`${id}-title`} className="preferences-sheet-title">Restore every setting to its default?</p>
        <p id={`${id}-text`} className="preferences-sheet-text">
          The desktop picture, text size, highlight colour, Dock and clock go back to how they started,
          and your own picture is removed from this browser.
        </p>
        <div className="preferences-sheet-buttons">
          <button ref={cancel} onClick={onDone}>Cancel</button>
          <button className="mac-button-primary" onClick={() => { restoreDefaults().finally(onDone); }}>
            Restore Defaults
          </button>
        </div>
      </div>
    </div>
  );
};

export default Preferences;
