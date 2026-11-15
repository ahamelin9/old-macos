// What the Dock shows, worked out from the open windows. Pure, so it is
// tested without a browser (dockItems.test.ts); Dock.tsx draws it.
//
//   [apps…] | [minimized windows…] [Trash]
//
// as in Mac OS X: a thin divider, then each minimized window as a small
// window with its app's icon on it, just left of the Trash.
import { APPS, type AppId } from '../Apps/apps';

interface WindowLike {
  id: number;
  appId?: AppId;
  title: string;
  minimized: boolean;
  /** Counts up with each minimize (WindowContext), so tiles keep the order they came in */
  minimizedAt?: number;
}

export interface WindowTile {
  /** A stable React key */
  key: string;
  /** The windows this tile stands for. Window.tsx aims its Scale effect at the tile holding its id */
  windowIds: number[];
  /** The window a click brings back */
  restoreId: number;
  appId?: AppId;
  /** Its label: the window's title */
  title: string;
  /** More than 1 only for the phone's folded tile */
  count: number;
}

/**
 * The apps in the Dock, in order: those marked inDock on a laptop, only those
 * marked onPhone under 800px. The Trash is kept apart, for the right end.
 */
export const dockApps = (phone: boolean) => {
  const shown = APPS.filter(app => app.inDock && (!phone || app.onPhone));
  return {
    apps: shown.filter(app => app.id !== 'trash'),
    trash: shown.find(app => app.id === 'trash')
  };
};

/** The apps with a window open, minimized or not: each gets a triangle under its icon */
export const runningApps = (windows: readonly WindowLike[]): Set<AppId> =>
  new Set(windows.flatMap(w => (w.appId ? [w.appId] : [])));

/**
 * The minimized windows' tiles, oldest first, so the newest sits next to the
 * Trash. `fold` (a phone) puts two or more into one tile that shows the
 * newest, with a count, and brings back the newest first: the Dock has room
 * for five apps there, and each phone app's own icon brings its window back too.
 */
export const windowTiles = (windows: readonly WindowLike[], { fold }: { fold: boolean }): WindowTile[] => {
  const minimized = windows
    .filter(w => w.minimized)
    .sort((a, b) => (a.minimizedAt ?? 0) - (b.minimizedAt ?? 0));
  if (!minimized.length) return [];
  if (fold && minimized.length > 1) {
    const newest = minimized[minimized.length - 1];
    return [{
      key: 'folded',
      windowIds: minimized.map(w => w.id),
      restoreId: newest.id,
      appId: newest.appId,
      title: newest.title,
      count: minimized.length
    }];
  }
  return minimized.map(w => ({
    key: `window-${w.id}`,
    windowIds: [w.id],
    restoreId: w.id,
    appId: w.appId,
    title: w.title,
    count: 1
  }));
};
