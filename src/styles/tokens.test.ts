import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

// Dark mode is written twice in tokens.css's Settings block: once for Dark,
// once for System on a dark computer (CSS can't say "either" in one
// selector). These tests keep the two copies the same, and check the light
// values (the tones and faces) are still their --grey-* twins.
const css = readFileSync(new URL('./tokens.css', import.meta.url), 'utf8').replace(/\/\*[\s\S]*?\*\//g, '');

/** The declarations inside the block that starts at `start`, as trimmed lines */
const block = (start: string) => {
  const at = css.indexOf(start);
  if (at < 0) return null;
  const from = css.indexOf('{', at) + 1;
  let depth = 1, i = from;
  for (; i < css.length; i++) {
    if (css[i] === '{') depth++;
    if (css[i] === '}' && --depth === 0) break;
  }
  return css.slice(from, i).split(';').map(d => d.replace(/\s+/g, ' ').trim()).filter(Boolean);
};

const forced = block(':root[data-theme="dark"]');
const system = block(':root:not([data-theme="light"])');

describe('the dark blocks in tokens.css', () => {
  it('are both there: Dark, and System on a dark computer', () => {
    expect(forced?.length).toBeGreaterThan(10);
    expect(css).toMatch(/@media \(prefers-color-scheme: dark\)\s*\{\s*:root:not\(\[data-theme="light"\]\)/);
  });

  it('match, line for line', () => {
    expect(system).toEqual(forced);
  });

  it('turn on the browser\'s own dark look too (scrollbars, fields, the date picker)', () => {
    expect(forced).toContain('color-scheme: dark');
  });

  it('give every tone, face and tint a dark value, and never change the palette', () => {
    const names = (forced ?? []).map(d => d.split(':')[0]);
    const light = css.match(/--(tone|face|tint)-\d+(?=:)/g) ?? [];
    for (const name of new Set(light)) expect(names).toContain(name);
    expect(names.filter(n => /^--(grey|blue|red|yellow|green|white|black)-/.test(n))).toEqual([]);
  });
});

describe('light mode', () => {
  it('keeps each tone, face and tint its palette twin, so light looks as it did', () => {
    // The light values: everything before the Settings block's first rule
    const light = css.slice(0, css.indexOf(':root[data-'));
    const twins = [...light.matchAll(/--(tone|face|tint)-(\d+): var\(--(grey|blue)-(\d+)\)/g)];
    expect(twins.length).toBeGreaterThan(30);
    for (const [, kind, n, ramp, m] of twins) {
      expect(ramp).toBe(kind === 'tint' ? 'blue' : 'grey');
      expect(m).toBe(n);
    }
  });
});
