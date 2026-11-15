import { readFileSync } from 'node:fs';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { format } from 'date-fns';
import {
  CHOICES,
  DEFAULTS,
  SETTINGS_KEY,
  applySettings,
  attributeName,
  clockPattern,
  loadSettings,
  parseSettings,
  saveSettings,
  validateSettings,
  type Settings
} from './settings';

/** A localStorage stand-in, put on a fake window */
const fakeStorage = (items: Record<string, string> = {}) => {
  const store = new Map(Object.entries(items));
  const storage = {
    getItem: (key: string) => store.get(key) ?? null,
    setItem: (key: string, value: string) => { store.set(key, value); },
    removeItem: (key: string) => { store.delete(key); }
  };
  vi.stubGlobal('window', { localStorage: storage });
  return store;
};

/** Storage switched off, as in some private windows: even reading window.localStorage throws */
const storageOff = () => {
  vi.stubGlobal('window', {
    get localStorage(): Storage { throw new DOMException('The operation is insecure.', 'SecurityError'); }
  });
};

afterEach(() => {
  vi.unstubAllGlobals();
});

const CHANGED: Settings = {
  wallpaper: 'pinstripe',
  theme: 'dark',
  textSize: 'larger',
  highlight: 'graphite',
  dockSize: 'small',
  dockMagnify: false,
  clock: '24',
  clockSeconds: true
};

describe('defaults', () => {
  it('match the site as it was before System Preferences', () => {
    expect(DEFAULTS).toEqual({
      wallpaper: 'photo',
      theme: 'system',
      textSize: 'medium',
      highlight: 'blue',
      dockSize: 'medium',
      dockMagnify: true,
      clock: '12',
      clockSeconds: false
    });
  });
});

describe('parseSettings', () => {
  it('gives the defaults when nothing is saved', () => {
    expect(parseSettings(null)).toEqual(DEFAULTS);
  });

  it('reads back what was saved', () => {
    expect(parseSettings(JSON.stringify(CHANGED))).toEqual(CHANGED);
  });

  it('survives text that is not JSON', () => {
    expect(parseSettings('{"textSize": "large"')).toEqual(DEFAULTS);
    expect(parseSettings('')).toEqual(DEFAULTS);
    expect(parseSettings('undefined')).toEqual(DEFAULTS);
  });

  it('survives JSON that is not an object', () => {
    for (const json of ['null', '42', '"large"', 'true', '[]', '["larger"]']) {
      expect(parseSettings(json)).toEqual(DEFAULTS);
    }
  });

  it('drops unknown keys', () => {
    const settings = parseSettings(JSON.stringify({ textSize: 'large', colour: 'dark', __proto__x: 1 }));
    expect(settings).toEqual({ ...DEFAULTS, textSize: 'large' });
    expect(Object.keys(settings).sort()).toEqual(Object.keys(DEFAULTS).sort());
  });

  it('turns a value of the wrong type into the default, one key at a time', () => {
    const settings = parseSettings(JSON.stringify({
      textSize: 3,
      highlight: 'graphite',
      dockMagnify: 'false',
      clock: 24,
      clockSeconds: 1,
      dockSize: null,
      wallpaper: { id: 'aqua' },
      theme: true
    }));
    expect(settings).toEqual({ ...DEFAULTS, highlight: 'graphite' });
  });

  it('turns a value it does not know (from a newer deploy, say) into the default', () => {
    expect(parseSettings(JSON.stringify({ textSize: 'huge', wallpaper: 'galaxy', dockSize: 'Large', theme: 'Dark' }))).toEqual(DEFAULTS);
  });
});

describe('theme (dark mode)', () => {
  it('offers System, Light and Dark, and System is the default', () => {
    expect(CHOICES.theme).toEqual(['system', 'light', 'dark']);
    expect(DEFAULTS.theme).toBe('system');
  });

  it('reads back Light and Dark', () => {
    expect(parseSettings(JSON.stringify({ theme: 'light' })).theme).toBe('light');
    expect(parseSettings(JSON.stringify({ theme: 'dark' })).theme).toBe('dark');
  });

  it('gives an older save, from before dark mode, System and keeps the rest', () => {
    const before = { wallpaper: 'aqua', textSize: 'larger', highlight: 'graphite', dockSize: 'small', dockMagnify: false, clock: '24', clockSeconds: true };
    expect(parseSettings(JSON.stringify(before))).toEqual({ ...before, theme: 'system' });
  });

  it('turns an unknown theme into System, alone', () => {
    for (const theme of ['auto', 'Dark', 'DARK', '', 0, null, ['dark'], { dark: true }]) {
      expect(parseSettings(JSON.stringify({ theme, textSize: 'large' }))).toEqual({ ...DEFAULTS, textSize: 'large' });
    }
  });

  it('goes on <html> as data-theme', () => {
    const root = fakeRoot();
    applySettings({ ...DEFAULTS, theme: 'light' }, root);
    expect(root.attributes['data-theme']).toBe('light');
  });
});

describe('validateSettings', () => {
  it('keeps the visitor’s own picture as a choice', () => {
    expect(validateSettings({ wallpaper: 'custom' }).wallpaper).toBe('custom');
  });

  it('does not let a prototype key through', () => {
    const settings = validateSettings(JSON.parse('{"__proto__": {"textSize": "larger"}}'));
    expect(settings.textSize).toBe('medium');
  });
});

describe('loadSettings and saveSettings', () => {
  it('reads the current key', () => {
    fakeStorage({ [SETTINGS_KEY]: JSON.stringify(CHANGED) });
    expect(loadSettings()).toEqual({ settings: CHANGED, upgraded: false });
  });

  it('gives the defaults when storage throws, without throwing', () => {
    storageOff();
    expect(loadSettings()).toEqual({ settings: DEFAULTS, upgraded: false });
    expect(saveSettings(CHANGED)).toBe(false);
  });

  it('gives the defaults when there is no window at all', () => {
    expect(loadSettings()).toEqual({ settings: DEFAULTS, upgraded: false });
  });

  it('saves one JSON value under the versioned key', () => {
    const store = fakeStorage();
    expect(saveSettings(CHANGED)).toBe(true);
    expect([...store.keys()]).toEqual(['macos-1999-settings-v1']);
    expect(JSON.parse(store.get(SETTINGS_KEY)!)).toEqual(CHANGED);
  });

  it('reports a full storage', () => {
    vi.stubGlobal('window', { localStorage: { setItem: () => { throw new DOMException('full', 'QuotaExceededError'); } } });
    expect(saveSettings(CHANGED)).toBe(false);
  });

  // No older format exists yet; these prove the path the first one will take
  const OLD = [{ key: 'macos-1999-settings-v0', upgrade: (old: unknown) => ({ textSize: (old as { fontSize: string }).fontSize }) }];

  it('upgrades an older format when that is all there is', () => {
    fakeStorage({ 'macos-1999-settings-v0': JSON.stringify({ fontSize: 'large' }) });
    expect(loadSettings(OLD)).toEqual({ settings: { ...DEFAULTS, textSize: 'large' }, upgraded: true });
  });

  it('prefers the current key to an older one', () => {
    fakeStorage({ [SETTINGS_KEY]: JSON.stringify({ textSize: 'small' }), 'macos-1999-settings-v0': JSON.stringify({ fontSize: 'large' }) });
    expect(loadSettings(OLD)).toEqual({ settings: { ...DEFAULTS, textSize: 'small' }, upgraded: false });
  });

  it('validates what an upgrade gives back, and survives a broken older value', () => {
    fakeStorage({ 'macos-1999-settings-v0': JSON.stringify({ fontSize: 'enormous' }) });
    expect(loadSettings(OLD).settings).toEqual(DEFAULTS);
    fakeStorage({ 'macos-1999-settings-v0': 'not json' });
    expect(loadSettings(OLD)).toEqual({ settings: DEFAULTS, upgraded: false });
    fakeStorage({ 'macos-1999-settings-v0': 'null' });
    expect(loadSettings(OLD).settings).toEqual(DEFAULTS);
  });
});

/** A stand-in for <html> that records its attributes */
const fakeRoot = () => {
  const attributes: Record<string, string> = {};
  return { attributes, setAttribute: (name: string, value: string) => { attributes[name] = value; } };
};

describe('applySettings', () => {
  it('puts every setting on <html> as a data-* attribute', () => {
    expect(attributeName('textSize')).toBe('data-text-size');
    expect(attributeName('dockMagnify')).toBe('data-dock-magnify');
    const root = fakeRoot();
    applySettings(CHANGED, root);
    expect(root.attributes).toEqual({
      'data-wallpaper': 'pinstripe',
      'data-theme': 'dark',
      'data-text-size': 'larger',
      'data-highlight': 'graphite',
      'data-dock-size': 'small',
      'data-dock-magnify': 'false',
      'data-clock': '24',
      'data-clock-seconds': 'true'
    });
  });
});

describe('the early script in index.html', () => {
  const html = readFileSync(new URL('../../index.html', import.meta.url), 'utf8');
  const script = html.match(/<script>([\s\S]*?)<\/script>/)?.[1] ?? '';

  /** Run the early script against a saved value (or a storage that throws) */
  const runEarly = (saved: string | null | (() => never)) => {
    const root = fakeRoot();
    const localStorage = { getItem: (key: string) => (typeof saved === 'function' ? saved() : key === SETTINGS_KEY ? saved : null) };
    new Function('localStorage', 'document', script)(localStorage, { documentElement: root });
    return root.attributes;
  };

  it('is there, and reads the same key', () => {
    expect(script).toContain(`'${SETTINGS_KEY}'`);
  });

  it('sets the same attributes as applySettings', () => {
    for (const settings of [DEFAULTS, CHANGED, { ...DEFAULTS, wallpaper: 'custom' as const }]) {
      const fromReact = fakeRoot();
      applySettings(settings, fromReact);
      expect(runEarly(JSON.stringify(settings))).toEqual(fromReact.attributes);
    }
  });

  it('sets no data-theme for a first visit or an older save, so tokens.css follows the computer', () => {
    expect(runEarly(null)).not.toHaveProperty('data-theme');
    expect(runEarly(JSON.stringify({ textSize: 'larger' }))).toEqual({ 'data-text-size': 'larger' });
    expect(runEarly(JSON.stringify({ theme: 'dark' }))).toEqual({ 'data-theme': 'dark' });
  });

  it('sets nothing, and throws nothing, for missing, broken or blocked storage', () => {
    expect(runEarly(null)).toEqual({});
    expect(runEarly('{oops')).toEqual({});
    expect(runEarly('[1, 2]')).toEqual({});
    expect(runEarly('"larger"')).toEqual({});
    expect(runEarly(() => { throw new DOMException('insecure', 'SecurityError'); })).toEqual({});
  });

  it('skips odd keys and values', () => {
    const odd = JSON.stringify({ textSize: '"><script>', highlight: { x: 1 }, 'bad key': 'x', dockSize: 'x'.repeat(40), clock: 24, dockMagnify: false });
    expect(runEarly(odd)).toEqual({ 'data-dock-magnify': 'false' });
  });
});

describe('clockPattern', () => {
  const at = new Date(2000, 0, 1, 15, 45, 30);
  it('gives 12- or 24-hour time, with or without seconds', () => {
    expect(format(at, clockPattern({ clock: '12', clockSeconds: false }))).toBe('3:45 PM');
    expect(format(at, clockPattern({ clock: '12', clockSeconds: true }))).toBe('3:45:30 PM');
    expect(format(at, clockPattern({ clock: '24', clockSeconds: false }))).toBe('15:45');
    expect(format(at, clockPattern({ clock: '24', clockSeconds: true }))).toBe('15:45:30');
  });

  it('keeps the default the menu bar always had', () => {
    expect(clockPattern(DEFAULTS)).toBe('h:mm a');
  });
});
