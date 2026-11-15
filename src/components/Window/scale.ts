// The Scale effect's aim: the transform that shrinks a window onto its tile
// in the Dock. Pure, so it is tested without a browser; Window.tsx measures
// the two boxes and Window/styles.css runs the animation.

export interface Box { left: number; top: number; width: number; height: number }

/** What a window shrinks to when its tile can't be found */
export const FALLBACK_SCALE = 'scale(0.1)';

/**
 * A CSS transform, about the window's centre (the default transform-origin),
 * that puts the window's centre on the tile's and shrinks it to fit inside
 * the tile, keeping its shape, as Mac OS X's Scale effect did.
 */
export const scaleToTile = (win: Box, tile: Box): string => {
  if (win.width <= 0 || win.height <= 0 || tile.width <= 0 || tile.height <= 0) return FALLBACK_SCALE;
  const scale = Math.min(tile.width / win.width, tile.height / win.height);
  const dx = tile.left + tile.width / 2 - (win.left + win.width / 2);
  const dy = tile.top + tile.height / 2 - (win.top + win.height / 2);
  const px = (n: number) => `${Math.round(n * 10) / 10}px`;
  return `translate(${px(dx)}, ${px(dy)}) scale(${Math.round(scale * 1000) / 1000})`;
};
