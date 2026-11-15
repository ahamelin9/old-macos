import { describe, expect, it } from 'vitest';
import { FALLBACK_SCALE, scaleToTile } from './scale';

describe('scaleToTile', () => {
  it('moves the window\'s centre onto the tile\'s and shrinks it to the tile\'s width', () => {
    // A 400x300 window at 100,100 (centre 300,250); a 48px tile at 676,820 (centre 700,844)
    expect(scaleToTile({ left: 100, top: 100, width: 400, height: 300 }, { left: 676, top: 820, width: 48, height: 48 }))
      .toBe('translate(400px, 594px) scale(0.12)');
  });

  it('keeps the window\'s shape: a tall window fits the tile\'s height', () => {
    expect(scaleToTile({ left: 0, top: 0, width: 200, height: 400 }, { left: 0, top: 0, width: 40, height: 40 }))
      .toMatch(/scale\(0\.1\)$/);
  });

  it('rounds to a tenth of a pixel and three places of scale', () => {
    expect(scaleToTile({ left: 0, top: 0, width: 300, height: 300 }, { left: 10.123, top: 20.6, width: 41, height: 41 }))
      .toBe('translate(-119.4px, -108.9px) scale(0.137)');
  });

  it('falls back to a plain shrink when a box has no size', () => {
    expect(scaleToTile({ left: 0, top: 0, width: 0, height: 300 }, { left: 0, top: 0, width: 48, height: 48 })).toBe(FALLBACK_SCALE);
    expect(scaleToTile({ left: 0, top: 0, width: 400, height: 300 }, { left: 0, top: 0, width: 0, height: 0 })).toBe(FALLBACK_SCALE);
  });
});
