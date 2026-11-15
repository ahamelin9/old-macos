import { describe, expect, it } from 'vitest';
import { dockApps, runningApps, windowTiles } from './dockItems';

type Win = Parameters<typeof windowTiles>[0][number];
const win = (id: number, appId: Win['appId'], minimizedAt?: number, title = `Window ${id}`): Win =>
  ({ id, appId, title, minimized: minimizedAt !== undefined, minimizedAt });

describe('dockApps', () => {
  it('keeps the Trash apart from the apps on a laptop', () => {
    const { apps, trash } = dockApps(false);
    expect(trash?.id).toBe('trash');
    expect(apps.map(a => a.id)).not.toContain('trash');
    expect(apps[0].id).toBe('finder');
    expect(apps.map(a => a.id)).toContain('preferences');
  });

  it('shows only the five phone apps, and no Trash, on a phone', () => {
    const { apps, trash } = dockApps(true);
    expect(apps.map(a => a.id)).toEqual(['finder', 'safari', 'nasa', 'pokemon', 'fieldguide']);
    expect(trash).toBeUndefined();
  });

  it('leaves out the Apple menu\'s own apps', () => {
    const ids = dockApps(false).apps.map(a => a.id);
    expect(ids).not.toContain('about');
    expect(ids).not.toContain('forcequit');
  });
});

describe('runningApps', () => {
  it('is empty with nothing open', () => {
    expect(runningApps([]).size).toBe(0);
  });

  it('counts an app with a window showing or minimized, once however many it has', () => {
    const running = runningApps([win(1, 'notes'), win(2, 'notes'), win(3, 'finder', 1)]);
    expect([...running].sort()).toEqual(['finder', 'notes']);
  });

  it('ignores a window opened without an app', () => {
    expect(runningApps([win(1, undefined)]).size).toBe(0);
  });

  it('drops an app once its last window closes', () => {
    const open = [win(1, 'notes'), win(2, 'camera')];
    expect(runningApps(open).has('camera')).toBe(true);
    expect(runningApps(open.filter(w => w.id !== 2)).has('camera')).toBe(false);
  });
});

describe('windowTiles', () => {
  it('has no tiles when nothing is minimized', () => {
    expect(windowTiles([win(1, 'notes'), win(2, 'finder')], { fold: false })).toEqual([]);
    expect(windowTiles([], { fold: true })).toEqual([]);
  });

  it('gives each minimized window its own tile on a laptop, with its title and app', () => {
    const tiles = windowTiles([win(1, 'notes', 1, 'Notes'), win(2, 'finder'), win(3, 'music', 2, 'Music')], { fold: false });
    expect(tiles).toEqual([
      { key: 'window-1', windowIds: [1], restoreId: 1, appId: 'notes', title: 'Notes', count: 1 },
      { key: 'window-3', windowIds: [3], restoreId: 3, appId: 'music', title: 'Music', count: 1 }
    ]);
  });

  it('keeps the order they were minimized in, not the order they opened in', () => {
    const tiles = windowTiles([win(1, 'notes', 5), win(2, 'finder', 3), win(3, 'music', 4)], { fold: false });
    expect(tiles.map(t => t.restoreId)).toEqual([2, 3, 1]);
  });

  it('gives two windows of one app a tile each', () => {
    expect(windowTiles([win(1, 'notes', 1), win(2, 'notes', 2)], { fold: false })).toHaveLength(2);
  });

  it('keeps a lone minimized window as a plain tile on a phone', () => {
    expect(windowTiles([win(1, 'finder', 1, 'Finder')], { fold: true })).toEqual([
      { key: 'window-1', windowIds: [1], restoreId: 1, appId: 'finder', title: 'Finder', count: 1 }
    ]);
  });

  it('folds two or more into one tile on a phone, showing and restoring the newest', () => {
    const windows = [win(1, 'finder', 1, 'Finder'), win(2, 'safari', 3, 'Safari'), win(3, 'nasa', 2, 'Nasa News'), win(4, 'pokemon')];
    expect(windowTiles(windows, { fold: true })).toEqual([
      { key: 'folded', windowIds: [1, 3, 2], restoreId: 2, appId: 'safari', title: 'Safari', count: 3 }
    ]);
  });

  it('keeps the folded tile\'s key as windows come and go, so it is not redrawn', () => {
    const three = [win(1, 'finder', 1), win(2, 'safari', 2), win(3, 'nasa', 3)];
    const two = three.slice(0, 2);
    expect(windowTiles(three, { fold: true })[0].key).toBe(windowTiles(two, { fold: true })[0].key);
  });

  it('after the newest comes back, the folded tile offers the one before it', () => {
    const windows = [win(1, 'finder', 1), win(2, 'safari', 2), win(3, 'nasa', 3)];
    const restored = windows.map(w => (w.id === 3 ? { ...w, minimized: false } : w));
    expect(windowTiles(restored, { fold: true })[0]).toMatchObject({ restoreId: 2, count: 2 });
  });

  it('copes with a window that has no app', () => {
    expect(windowTiles([win(1, undefined, 1, 'Hello')], { fold: false })[0]).toMatchObject({ appId: undefined, title: 'Hello' });
  });
});
