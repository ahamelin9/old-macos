import { describe, expect, it } from 'vitest';
import { planShowApp } from './showApp';

const win = (id: number, appId: string | undefined, zIndex: number, minimized = false) =>
  ({ id, appId, zIndex, minimized }) as Parameters<typeof planShowApp>[0][number];

describe('planShowApp', () => {
  it('opens a window when nothing is open', () => {
    expect(planShowApp([], 'preferences')).toEqual({ kind: 'open' });
  });

  it('opens a window when only other apps are open', () => {
    expect(planShowApp([win(1, 'finder', 2), win(2, 'planes', 3)], 'preferences')).toEqual({ kind: 'open' });
  });

  it('ignores a window opened without an app id, even with the same title', () => {
    expect(planShowApp([win(1, undefined, 2)], 'preferences')).toEqual({ kind: 'open' });
  });

  it('brings a window behind others to the front', () => {
    expect(planShowApp([win(1, 'preferences', 2), win(2, 'finder', 3)], 'preferences'))
      .toEqual({ kind: 'show', id: 1, restore: false, inFront: false });
  });

  it('says when the window is already in front, so nothing has to move', () => {
    expect(planShowApp([win(1, 'finder', 2), win(2, 'preferences', 3)], 'preferences'))
      .toEqual({ kind: 'show', id: 2, restore: false, inFront: true });
  });

  it('counts a window as in front when only minimized ones sit above it', () => {
    expect(planShowApp([win(1, 'preferences', 2), win(2, 'finder', 5, true)], 'preferences'))
      .toEqual({ kind: 'show', id: 1, restore: false, inFront: true });
  });

  it('restores a minimized window', () => {
    expect(planShowApp([win(1, 'preferences', 4, true), win(2, 'finder', 3)], 'preferences'))
      .toEqual({ kind: 'show', id: 1, restore: true, inFront: false });
  });

  it('prefers a showing window over a minimized one, whatever their order', () => {
    expect(planShowApp([win(1, 'finder', 9, true), win(2, 'finder', 3), win(3, 'planes', 4)], 'finder'))
      .toEqual({ kind: 'show', id: 2, restore: false, inFront: false });
  });

  it('picks the front one of several showing windows', () => {
    expect(planShowApp([win(1, 'finder', 3), win(2, 'finder', 6), win(3, 'finder', 4)], 'finder'))
      .toMatchObject({ id: 2, inFront: true });
  });

  it('picks the one that was in front last when all are minimized', () => {
    expect(planShowApp([win(1, 'finder', 3, true), win(2, 'finder', 7, true), win(3, 'planes', 8)], 'finder'))
      .toEqual({ kind: 'show', id: 2, restore: true, inFront: false });
  });
});
