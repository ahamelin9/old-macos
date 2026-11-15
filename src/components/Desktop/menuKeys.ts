// The keyboard in a pull-down menu with one level of submenu (the Apple
// menu): which row each key highlights, when a submenu opens, what Enter
// chooses. Pure, so it is tested without a browser; AppleMenu.tsx feeds it
// each key and acts on the result.

export type EntryKind = 'item' | 'submenu' | 'separator';

export interface MenuState {
  open: boolean;
  /** The highlighted row in the menu, or null for none (opened by a click) */
  active: number | null;
  /** Whether the active row's submenu is showing */
  subOpen: boolean;
  /** The highlighted row in the submenu; null while the keyboard is still in the menu */
  subActive: number | null;
}

export const CLOSED: MenuState = { open: false, active: null, subOpen: false, subActive: null };

export type MenuEffect =
  /** Run this row (or this row of its submenu) and close the menu */
  | { type: 'choose'; index: number; subIndex: number | null }
  /** Closed from the keyboard, so the focus goes back to the menu's title */
  | { type: 'close' }
  | null;

export interface KeyResult {
  state: MenuState;
  effect: MenuEffect;
  /** False for a key the menu doesn't use, which should do what it normally does */
  handled: boolean;
}

/**
 * The next row that can be highlighted after `from` (or from the top or
 * bottom when null), going down (1) or up (-1), wrapping round and skipping
 * separators.
 */
export const nextEntry = (entries: readonly EntryKind[], from: number | null, step: 1 | -1): number | null => {
  const n = entries.length;
  let i = from ?? (step === 1 ? -1 : n);
  for (let tries = 0; tries < n; tries++) {
    i = (i + step + n) % n;
    if (entries[i] !== 'separator') return i;
  }
  return null;
};

/**
 * What `key` (a KeyboardEvent.key) does, given the menu's rows, how many rows
 * its submenu has, and where the highlight is. Closed, Down, Enter and Space
 * open it at the top and Up at the bottom. Open: Up and Down move (wrapping),
 * Home and End jump, Right (or Enter or Space) on a submenu row opens the
 * submenu, Left and Escape close it, Enter and Space choose, and Escape or Tab
 * close the menu.
 */
export const menuKey = (entries: readonly EntryKind[], subCount: number, state: MenuState, key: string): KeyResult => {
  const to = (change: Partial<MenuState>, effect: MenuEffect = null): KeyResult =>
    ({ state: { ...state, ...change }, effect, handled: true });
  const close: KeyResult = { state: CLOSED, effect: { type: 'close' }, handled: true };
  const choose = (index: number, subIndex: number | null): KeyResult =>
    ({ state: CLOSED, effect: { type: 'choose', index, subIndex }, handled: true });
  const enter = key === 'Enter' || key === ' ';

  if (!state.open) {
    if (key === 'ArrowDown' || enter) return to({ open: true, active: nextEntry(entries, null, 1), subOpen: false, subActive: null });
    if (key === 'ArrowUp') return to({ open: true, active: nextEntry(entries, null, -1), subOpen: false, subActive: null });
    return { state, effect: null, handled: false };
  }

  if (key === 'Tab') return close;

  // In the submenu
  if (state.subOpen && state.subActive !== null && state.active !== null) {
    const last = subCount - 1;
    switch (key) {
      case 'ArrowDown': return to({ subActive: state.subActive >= last ? 0 : state.subActive + 1 });
      case 'ArrowUp': return to({ subActive: state.subActive <= 0 ? last : state.subActive - 1 });
      case 'Home': return to({ subActive: 0 });
      case 'End': return to({ subActive: last });
      case 'ArrowLeft':
      case 'Escape': return to({ subOpen: false, subActive: null });
      case 'ArrowRight': return to({});
    }
    if (enter) return choose(state.active, state.subActive);
    return { state, effect: null, handled: false };
  }

  // In the menu (a submenu may be showing from the pointer, with nothing in it highlighted)
  const move = (active: number | null) => to({ active, subOpen: false, subActive: null });
  const kind = state.active === null ? null : entries[state.active];
  switch (key) {
    case 'ArrowDown': return move(nextEntry(entries, state.active, 1));
    case 'ArrowUp': return move(nextEntry(entries, state.active, -1));
    case 'Home': return move(nextEntry(entries, null, 1));
    case 'End': return move(nextEntry(entries, null, -1));
    case 'Escape': return close;
    case 'ArrowLeft': return to({ subOpen: false, subActive: null });
    case 'ArrowRight': return kind === 'submenu' && subCount > 0 ? to({ subOpen: true, subActive: 0 }) : to({});
  }
  if (enter) {
    if (state.active === null) return to({});
    if (kind === 'submenu') return subCount > 0 ? to({ subOpen: true, subActive: 0 }) : to({});
    return choose(state.active, null);
  }
  return { state, effect: null, handled: false };
};
