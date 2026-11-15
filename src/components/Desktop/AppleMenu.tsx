// React
import React, { useCallback, useEffect, useId, useLayoutEffect, useRef, useState } from 'react';
// Context
import { useWindows } from '../../contexts/useWindows';
import { useSettings } from '../../contexts/useSettings';
// Keyboard
import { CLOSED, menuKey, type MenuState } from './menuKeys';

interface Item {
  label: string;
  action: () => void;
}

type Entry =
  | ({ kind: 'item' } & Item)
  | { kind: 'submenu'; label: string; items: Item[] }
  | { kind: 'separator' };

/** Where the submenu goes: beside the menu, on its left when the right has no room, or inside it on a narrow phone */
type Placement = 'right' | 'left' | 'inline';

/** How long a submenu stays open after the pointer moves to another row, so a diagonal path into it doesn't shut it */
const SUBMENU_GRACE_MS = 250;
/** The gap a submenu keeps from the screen's edge */
const EDGE = 4;

const isPointer = (e: React.PointerEvent) => e.pointerType === 'mouse' || e.pointerType === 'pen';

/**
 * The Apple menu, as in Mac OS X 10.0–10.2: the 🍎 in the menu bar is a
 * button that opens it. Click it, or press Enter, Space or Down on it; click
 * it again, click outside or press Escape to close. The keyboard is
 * menuKeys.ts. The look is the kit's mac-menu (kit.css).
 */
const AppleMenu: React.FC<{ onSleep: () => void; onRestart: () => void }> = ({ onSleep, onRestart }) => {
  const { showApp } = useWindows();
  const { settings, change } = useSettings();
  const [state, setState] = useState<MenuState>(CLOSED);
  const [placement, setPlacement] = useState<Placement>('right');
  const id = useId();
  const slot = useRef<HTMLDivElement>(null);
  const button = useRef<HTMLButtonElement>(null);
  const menu = useRef<HTMLDivElement>(null);
  const submenu = useRef<HTMLDivElement>(null);
  const rows = useRef<(HTMLDivElement | null)[]>([]);
  const subRows = useRef<(HTMLDivElement | null)[]>([]);
  const closeTimer = useRef<number | undefined>(undefined);

  // Separators where Mac OS X had them
  const entries: Entry[] = [
    { kind: 'item', label: 'About This Mac', action: () => showApp('about') },
    { kind: 'separator' },
    { kind: 'item', label: 'System Preferences…', action: () => showApp('preferences') },
    {
      kind: 'submenu',
      label: 'Dock',
      items: [
        {
          label: settings.dockMagnify ? 'Turn Magnification Off' : 'Turn Magnification On',
          action: () => change({ dockMagnify: !settings.dockMagnify })
        },
        { label: 'Dock Preferences…', action: () => showApp('preferences', { pane: 'dock' }) }
      ]
    },
    { kind: 'separator' },
    { kind: 'item', label: 'Force Quit…', action: () => showApp('forcequit') },
    { kind: 'separator' },
    { kind: 'item', label: 'Sleep', action: onSleep },
    { kind: 'item', label: 'Restart…', action: onRestart }
  ];
  const kinds = entries.map(e => e.kind);
  const subIndex = entries.findIndex(e => e.kind === 'submenu');
  const subCount = entries.reduce((n, e) => (e.kind === 'submenu' ? e.items.length : n), 0);

  const cancelTimer = () => window.clearTimeout(closeTimer.current);

  const close = useCallback((refocus: boolean) => {
    window.clearTimeout(closeTimer.current);
    setState(CLOSED);
    if (refocus) button.current?.focus();
  }, []);

  /** Close, then run the row: keyboard users get the focus back on the 🍎 */
  const choose = (index: number, sub: number | null, byKeyboard: boolean) => {
    const entry = entries[index];
    const action = entry.kind === 'item' ? entry.action : entry.kind === 'submenu' && sub !== null ? entry.items[sub].action : null;
    if (!action) return;
    close(byKeyboard);
    action();
  };

  // The focus follows the highlight, so a screen reader reads the row; with
  // nothing highlighted (opened by a click) the menu itself holds it
  useEffect(() => {
    if (!state.open) return;
    const target = state.subOpen && state.subActive !== null
      ? subRows.current[state.subActive]
      : state.active !== null ? rows.current[state.active] : menu.current;
    target?.focus({ preventScroll: true });
  }, [state]);

  // A press anywhere else closes it
  useEffect(() => {
    if (!state.open) return;
    const onPress = (e: PointerEvent) => {
      if (!slot.current?.contains(e.target as Node)) close(false);
    };
    document.addEventListener('pointerdown', onPress, true);
    return () => document.removeEventListener('pointerdown', onPress, true);
  }, [state.open, close]);

  useEffect(() => {
    const timer = closeTimer;
    return () => window.clearTimeout(timer.current);
  }, []);

  // The submenu opens to the right; if it would run off the screen, to the
  // left; if neither side has room (a phone), inside the menu under its row.
  // Measured before the browser paints, so it never shows in the wrong place.
  useLayoutEffect(() => {
    if (!state.subOpen) {
      setPlacement('right');
      return;
    }
    const sub = submenu.current?.getBoundingClientRect();
    const main = menu.current?.getBoundingClientRect();
    if (!sub || !main) return;
    if (sub.right <= window.innerWidth - EDGE) return;
    setPlacement(main.left - sub.width >= EDGE ? 'left' : 'inline');
  }, [state.subOpen]);

  const onKeyDown = (e: React.KeyboardEvent) => {
    const result = menuKey(kinds, subCount, state, e.key);
    if (!result.handled) return;
    e.preventDefault();
    e.stopPropagation();
    cancelTimer();
    const { effect } = result;
    if (effect?.type === 'choose') choose(effect.index, effect.subIndex, true);
    else if (effect?.type === 'close') close(true);
    else setState(result.state);
  };

  const openSubmenu = () => {
    cancelTimer();
    setState(s => ({ ...s, active: subIndex, subOpen: true, subActive: null }));
  };

  /** The pointer over a row of the menu. Touch skips this: a tap is a click */
  const hoverRow = (index: number) => (e: React.PointerEvent) => {
    if (!isPointer(e)) return;
    if (index === subIndex) return openSubmenu();
    setState(s => ({ ...s, active: index, subActive: null }));
    if (state.subOpen) {
      cancelTimer();
      closeTimer.current = window.setTimeout(() => setState(s => ({ ...s, subOpen: false, subActive: null })), SUBMENU_GRACE_MS);
    }
  };

  const hoverSubRow = (index: number) => (e: React.PointerEvent) => {
    if (!isPointer(e)) return;
    cancelTimer();
    setState(s => ({ ...s, active: subIndex, subOpen: true, subActive: index }));
  };

  const rowClass = (highlighted: boolean) => `mac-menu-item${highlighted ? ' mac-highlighted' : ''}`;

  return (
    <div className="mac-menu-bar-menus" role="menubar" aria-label="Menu bar">
      <div className="mac-menu-bar-slot" role="none" ref={slot} onKeyDown={onKeyDown}>
        <button
          ref={button}
          className="mac-menu-bar-apple"
          role="menuitem"
          aria-label="Apple"
          aria-haspopup="menu"
          aria-expanded={state.open}
          aria-controls={state.open ? `${id}-menu` : undefined}
          onClick={() => (state.open ? close(false) : setState({ ...CLOSED, open: true }))}
          // Space opens it on keydown (above); stop the button clicking again on keyup
          onKeyUp={e => { if (e.key === ' ') e.preventDefault(); }}
        >
          <span className="apple-logo" aria-hidden="true">🍎</span>
        </button>

        {state.open && (
          <div
            ref={menu}
            id={`${id}-menu`}
            className="mac-menu mac-menu-bar-apple-menu"
            role="menu"
            aria-label="Apple"
            tabIndex={-1}
            onPointerLeave={e => {
              if (isPointer(e) && !state.subOpen) setState(s => ({ ...s, active: null }));
            }}
          >
            {entries.map((entry, i) => {
              if (entry.kind === 'separator') {
                return <div key={i} className="mac-menu-separator" role="separator" />;
              }
              if (entry.kind === 'item') {
                return (
                  <div
                    key={i}
                    ref={el => { rows.current[i] = el; }}
                    className={rowClass(state.active === i)}
                    role="menuitem"
                    tabIndex={-1}
                    onPointerEnter={hoverRow(i)}
                    onClick={() => choose(i, null, false)}
                  >
                    {entry.label}
                  </div>
                );
              }
              return (
                <div key={i} className="mac-menu-parent" role="none">
                  <div
                    ref={el => { rows.current[i] = el; }}
                    className={rowClass(state.active === i)}
                    role="menuitem"
                    tabIndex={-1}
                    aria-haspopup="menu"
                    aria-expanded={state.subOpen}
                    aria-controls={state.subOpen ? `${id}-sub` : undefined}
                    onPointerEnter={hoverRow(i)}
                    // A tap (or a click) opens it; the pointer opens it on hover too
                    onClick={openSubmenu}
                  >
                    <span>{entry.label}</span>
                    <span className="mac-menu-arrow" aria-hidden="true">▸</span>
                  </div>
                  {state.subOpen && (
                    <div
                      ref={submenu}
                      id={`${id}-sub`}
                      className={`mac-menu mac-submenu mac-submenu-${placement}`}
                      role="menu"
                      aria-label={entry.label}
                    >
                      {entry.items.map((item, j) => (
                        <div
                          key={j}
                          ref={el => { subRows.current[j] = el; }}
                          className={rowClass(state.subActive === j)}
                          role="menuitem"
                          tabIndex={-1}
                          onPointerEnter={hoverSubRow(j)}
                          onClick={() => choose(i, j, false)}
                        >
                          {item.label}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
};

export default AppleMenu;
