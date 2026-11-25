import { describe, expect, it } from 'vitest';
import { back, canGoBack, canGoForward, current, forward, startHistory, visit } from './finderHistory';

describe('Finder history', () => {
  it('starts with nowhere to go', () => {
    const h = startHistory('home');
    expect(current(h)).toBe('home');
    expect(canGoBack(h)).toBe(false);
    expect(canGoForward(h)).toBe(false);
  });

  it('goes back and forward through the folders opened', () => {
    let h = visit(visit(startHistory('home'), 'projects'), 'utilities');
    expect(current(h)).toBe('utilities');
    h = back(h);
    expect(current(h)).toBe('projects');
    expect(canGoForward(h)).toBe(true);
    h = back(back(h));
    expect(current(h)).toBe('home');
    h = forward(forward(forward(h)));
    expect(current(h)).toBe('utilities');
  });

  it('opening a folder after going back drops what was ahead', () => {
    const h = visit(back(visit(startHistory('home'), 'projects')), 'utilities');
    expect(h.stack).toEqual(['home', 'utilities']);
    expect(canGoForward(h)).toBe(false);
  });

  it('opening the folder already showing adds nothing', () => {
    const h = startHistory('home');
    expect(visit(h, 'home')).toBe(h);
  });
});
