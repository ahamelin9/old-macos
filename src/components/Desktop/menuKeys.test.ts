import { describe, expect, it } from 'vitest';
import { CLOSED, menuKey, nextEntry, type EntryKind, type MenuState } from './menuKeys';

// The Apple menu's shape: About, -, System Preferences, Dock ▸, -, Force Quit, -, Sleep, Restart
const APPLE: EntryKind[] = ['item', 'separator', 'item', 'submenu', 'separator', 'item', 'separator', 'item', 'item'];
const DOCK = 3;
const SUB = 2;

/** Press keys in turn from a state, returning the last result */
const press = (state: MenuState, ...keys: string[]) => {
  let result = { state, effect: null as ReturnType<typeof menuKey>['effect'], handled: false };
  for (const key of keys) result = menuKey(APPLE, SUB, result.state, key);
  return result;
};
const open = (active: number | null, extra: Partial<MenuState> = {}): MenuState =>
  ({ open: true, active, subOpen: false, subActive: null, ...extra });

describe('nextEntry', () => {
  it('starts at the top going down and the bottom going up', () => {
    expect(nextEntry(APPLE, null, 1)).toBe(0);
    expect(nextEntry(APPLE, null, -1)).toBe(8);
  });

  it('skips separators', () => {
    expect(nextEntry(APPLE, 0, 1)).toBe(2);
    expect(nextEntry(APPLE, 3, 1)).toBe(5);
    expect(nextEntry(APPLE, 7, -1)).toBe(5);
  });

  it('wraps round both ways', () => {
    expect(nextEntry(APPLE, 8, 1)).toBe(0);
    expect(nextEntry(APPLE, 0, -1)).toBe(8);
  });

  it('gives null for a menu of only separators', () => {
    expect(nextEntry(['separator', 'separator'], null, 1)).toBeNull();
  });
});

describe('menuKey, closed', () => {
  it('opens at the first row on Down, Enter or Space', () => {
    for (const key of ['ArrowDown', 'Enter', ' ']) {
      expect(press(CLOSED, key)).toEqual({ state: open(0), effect: null, handled: true });
    }
  });

  it('opens at the last row on Up', () => {
    expect(press(CLOSED, 'ArrowUp').state).toEqual(open(8));
  });

  it('leaves other keys alone', () => {
    expect(press(CLOSED, 'a')).toMatchObject({ state: CLOSED, handled: false });
    expect(press(CLOSED, 'Escape').handled).toBe(false);
  });
});

describe('menuKey, in the menu', () => {
  it('moves down and up past separators, wrapping round', () => {
    expect(press(open(0), 'ArrowDown').state.active).toBe(2);
    expect(press(open(0), 'ArrowDown', 'ArrowDown', 'ArrowDown').state.active).toBe(5);
    expect(press(open(8), 'ArrowDown').state.active).toBe(0);
    expect(press(open(0), 'ArrowUp').state.active).toBe(8);
  });

  it('starts from the top or bottom when opened by a click (nothing highlighted)', () => {
    expect(press(open(null), 'ArrowDown').state.active).toBe(0);
    expect(press(open(null), 'ArrowUp').state.active).toBe(8);
  });

  it('jumps with Home and End', () => {
    expect(press(open(5), 'Home').state.active).toBe(0);
    expect(press(open(2), 'End').state.active).toBe(8);
  });

  it('chooses a row with Enter or Space, and closes', () => {
    expect(press(open(2), 'Enter')).toEqual({ state: CLOSED, effect: { type: 'choose', index: 2, subIndex: null }, handled: true });
    expect(press(open(7), ' ').effect).toEqual({ type: 'choose', index: 7, subIndex: null });
  });

  it('does nothing on Enter with nothing highlighted', () => {
    expect(press(open(null), 'Enter')).toMatchObject({ state: open(null), effect: null, handled: true });
  });

  it('closes on Escape or Tab, sending the focus back to the title', () => {
    expect(press(open(2), 'Escape')).toEqual({ state: CLOSED, effect: { type: 'close' }, handled: true });
    expect(press(open(2), 'Tab')).toEqual({ state: CLOSED, effect: { type: 'close' }, handled: true });
  });

  it('opens the submenu at its first row with Right, Enter or Space on Dock', () => {
    for (const key of ['ArrowRight', 'Enter', ' ']) {
      expect(press(open(DOCK), key)).toEqual({ state: open(DOCK, { subOpen: true, subActive: 0 }), effect: null, handled: true });
    }
  });

  it('ignores Right on a row with no submenu', () => {
    expect(press(open(2), 'ArrowRight')).toMatchObject({ state: open(2), effect: null, handled: true });
  });

  it('closes a submenu the pointer opened when the keyboard moves on', () => {
    expect(press(open(DOCK, { subOpen: true }), 'ArrowDown').state).toEqual(open(5));
  });

  it('enters a submenu the pointer opened with Right', () => {
    expect(press(open(DOCK, { subOpen: true }), 'ArrowRight').state).toEqual(open(DOCK, { subOpen: true, subActive: 0 }));
  });

  it('leaves typing alone', () => {
    expect(press(open(2), 'x')).toMatchObject({ state: open(2), handled: false });
  });
});

describe('menuKey, in the submenu', () => {
  const inSub = (subActive: number) => open(DOCK, { subOpen: true, subActive });

  it('moves down and up, wrapping round', () => {
    expect(press(inSub(0), 'ArrowDown').state.subActive).toBe(1);
    expect(press(inSub(1), 'ArrowDown').state.subActive).toBe(0);
    expect(press(inSub(0), 'ArrowUp').state.subActive).toBe(1);
  });

  it('jumps with Home and End', () => {
    expect(press(inSub(1), 'Home').state.subActive).toBe(0);
    expect(press(inSub(0), 'End').state.subActive).toBe(1);
  });

  it('goes back to Dock with Left or Escape, leaving the menu open', () => {
    expect(press(inSub(1), 'ArrowLeft').state).toEqual(open(DOCK));
    expect(press(inSub(1), 'Escape')).toEqual({ state: open(DOCK), effect: null, handled: true });
  });

  it('chooses a submenu row with Enter or Space', () => {
    expect(press(inSub(1), 'Enter')).toEqual({ state: CLOSED, effect: { type: 'choose', index: DOCK, subIndex: 1 }, handled: true });
    expect(press(inSub(0), ' ').effect).toEqual({ type: 'choose', index: DOCK, subIndex: 0 });
  });

  it('closes everything on Tab', () => {
    expect(press(inSub(0), 'Tab')).toEqual({ state: CLOSED, effect: { type: 'close' }, handled: true });
  });

  it('works through a whole trip: open, down to Dock, in, down, choose', () => {
    expect(press(CLOSED, 'Enter', 'ArrowDown', 'ArrowDown', 'ArrowRight', 'ArrowDown', 'Enter').effect)
      .toEqual({ type: 'choose', index: DOCK, subIndex: 1 });
  });
});
