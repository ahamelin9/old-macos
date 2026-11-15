// What showApp (useWindows) does for an app: bring its window back, or open
// one. Pure, so it is tested without a browser; WindowContext.tsx acts on it.
import type { AppId } from '../components/Apps/apps';

interface WindowLike {
  id: number;
  appId?: AppId;
  minimized: boolean;
  zIndex: number;
}

export type ShowPlan =
  /** The app has no window: open one */
  | { kind: 'open' }
  /**
   * Bring this window to the front. `restore` when it is minimized;
   * `inFront` when it is already the front window, so nothing needs to move.
   */
  | { kind: 'show'; id: number; restore: boolean; inFront: boolean };

/**
 * The window showApp brings back, when the app has more than one: the front
 * one that is showing, or, when all of them are minimized, the one that was
 * in front last.
 */
export const planShowApp = (windows: readonly WindowLike[], appId: AppId): ShowPlan => {
  const own = windows.filter(w => w.appId === appId);
  if (!own.length) return { kind: 'open' };
  const byZ = (a: WindowLike, b: WindowLike) => b.zIndex - a.zIndex;
  const target = [...own.filter(w => !w.minimized).sort(byZ), ...own.filter(w => w.minimized).sort(byZ)][0];
  const inFront = !target.minimized && windows.every(w => w === target || w.minimized || w.zIndex < target.zIndex);
  return { kind: 'show', id: target.id, restore: target.minimized, inFront };
};
