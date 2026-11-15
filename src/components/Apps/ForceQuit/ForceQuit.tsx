// React
import React, { useId, useState } from 'react';
// Context
import { useWindows } from '../../../contexts/useWindows';
import { appInfo } from '../apps';
// Styling
import './ForceQuit.css';

/** For a window opened with openWindow, which has no app */
const GENERIC_ICON = '/macintosh-favicon.png';

/**
 * Force Quit Applications, as in Mac OS X 10.0–10.2: every open window,
 * minimized ones too, each with its app's icon. Pick one and press Force
 * Quit to close it. It leaves itself off the list, as the Mac did.
 */
const ForceQuit: React.FC = () => {
  const { windows, closeWindow } = useWindows();
  const id = useId();
  const listed = windows.filter(w => w.appId !== 'forcequit');
  const [picked, setPicked] = useState<number | null>(null);
  // A picked window that has since closed counts as nothing picked
  const selected = listed.some(w => w.id === picked) ? picked : null;
  const at = listed.findIndex(w => w.id === selected);

  const quit = () => {
    if (selected === null) return;
    // Pick the next one down (or up, from the bottom), ready for another
    const next = listed[at + 1] ?? listed[at - 1];
    closeWindow(selected);
    setPicked(next ? next.id : null);
  };

  const onKeyDown = (e: React.KeyboardEvent) => {
    if (!listed.length) return;
    const move = e.key === 'ArrowDown' ? 1 : e.key === 'ArrowUp' ? -1 : 0;
    if (move) {
      e.preventDefault();
      const i = at < 0 ? (move > 0 ? 0 : listed.length - 1) : Math.max(0, Math.min(listed.length - 1, at + move));
      setPicked(listed[i].id);
    } else if (e.key === 'Home' || e.key === 'End') {
      e.preventDefault();
      setPicked(listed[e.key === 'Home' ? 0 : listed.length - 1].id);
    } else if (e.key === 'Enter' && selected !== null) {
      e.preventDefault();
      quit();
    }
  };

  return (
    <div className="forcequit-app">
      <p id={`${id}-intro`} className="forcequit-intro">
        If a window stops responding, select it and click Force Quit.
      </p>
      <div
        className="forcequit-list"
        role="listbox"
        tabIndex={0}
        aria-label="Open windows"
        aria-describedby={`${id}-intro`}
        aria-activedescendant={selected === null ? undefined : `${id}-${selected}`}
        onKeyDown={onKeyDown}
      >
        {listed.map(w => (
          <div
            key={w.id}
            id={`${id}-${w.id}`}
            role="option"
            aria-selected={w.id === selected}
            className={`forcequit-row mac-list-row${w.id === selected ? ' mac-selected' : ''}`}
            onClick={() => setPicked(w.id)}
          >
            <img className="forcequit-icon" src={w.appId ? appInfo(w.appId).icon : GENERIC_ICON} alt="" />
            <span className="forcequit-name">{w.title}</span>
            {w.minimized && <span className="forcequit-state">Minimized</span>}
          </div>
        ))}
        {!listed.length && <p className="mac-message">No other windows are open.</p>}
      </div>
      <div className="forcequit-buttons">
        <button className="mac-button-primary" onClick={quit} disabled={selected === null}>
          Force Quit
        </button>
      </div>
    </div>
  );
};

export default ForceQuit;
