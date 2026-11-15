// What System Preferences can change, the defaults, and how the choices are
// saved and read back. Pure functions, so they can be tested without a
// browser; SettingsContext.tsx holds the live copy. How it all fits: the
// system-map skill, "Settings".
import { readStored, writeStored } from './storage';

/** The one localStorage key. Bump the suffix only for a change old code can't read (see loadSettings). */
export const SETTINGS_KEY = 'macos-1999-settings-v1';

/** The desktop pictures. Each one's look is --wallpaper-<id> in tokens.css; 'custom' is the visitor's own picture. */
export const WALLPAPERS = [
  { id: 'photo', name: 'Photo' },
  { id: 'aqua', name: 'Aqua' },
  { id: 'ripple', name: 'Ripple' },
  { id: 'sky', name: 'Sky' },
  { id: 'lagoon', name: 'Lagoon' },
  { id: 'tangerine', name: 'Tangerine' },
  { id: 'graphite', name: 'Graphite' },
  { id: 'pinstripe', name: 'Pinstripe' }
] as const;

export type WallpaperId = (typeof WALLPAPERS)[number]['id'] | 'custom';

/**
 * Every setting is one choice from a fixed list, so one rule validates them
 * all. The first entry is the default. To add a setting, add a line here; an
 * older save without it simply gets the default, so it needs no new key
 * (dark mode's `theme` came in that way).
 */
export const CHOICES = {
  wallpaper: [...WALLPAPERS.map(w => w.id), 'custom'] as WallpaperId[],
  // System follows the computer's light or dark setting, live (tokens.css)
  theme: ['system', 'light', 'dark'],
  textSize: ['medium', 'small', 'large', 'larger'],
  highlight: ['blue', 'graphite'],
  dockSize: ['medium', 'small', 'large'],
  dockMagnify: [true, false],
  clock: ['12', '24'],
  clockSeconds: [false, true]
} as const satisfies Record<string, readonly (string | boolean)[]>;

export type Settings = { -readonly [K in keyof typeof CHOICES]: (typeof CHOICES)[K][number] };
export type SettingKey = keyof Settings;

const KEYS = Object.keys(CHOICES) as SettingKey[];

export const DEFAULTS: Settings = Object.fromEntries(KEYS.map(k => [k, CHOICES[k][0]])) as Settings;

/** True when `value` is one of the choices for `key` */
export const isChoice = <K extends SettingKey>(key: K, value: unknown): value is Settings[K] =>
  (CHOICES[key] as readonly unknown[]).includes(value);

/**
 * Settings from anything at all: each known key with an allowed value is
 * kept, anything else (an unknown key, a wrong type, a value from a newer
 * deploy) falls back to its default, one key at a time.
 */
export const validateSettings = (raw: unknown): Settings => {
  const source = raw && typeof raw === 'object' && !Array.isArray(raw) ? (raw as Record<string, unknown>) : {};
  const out = { ...DEFAULTS } as Record<SettingKey, unknown>;
  for (const key of KEYS) {
    if (isChoice(key, source[key])) out[key] = source[key];
  }
  return out as Settings;
};

/** The saved JSON, or the defaults when it is missing or not JSON */
export const parseSettings = (json: string | null): Settings => {
  if (json === null) return { ...DEFAULTS };
  try {
    return validateSettings(JSON.parse(json));
  } catch {
    return { ...DEFAULTS };
  }
};

/**
 * A format older code can't read moves to a new key (…-v2), and the old key
 * gets an entry here, newest first, saying how to turn its value into the
 * current shape. None yet: v1 is the first.
 */
export interface OlderFormat {
  key: string;
  upgrade: (old: unknown) => unknown;
}
export const OLDER_FORMATS: OlderFormat[] = [];

export interface Loaded {
  settings: Settings;
  /** True when the settings came from an older key and should be saved under the current one */
  upgraded: boolean;
}

/** Read the saved settings, upgrading an older format if that's all there is */
export const loadSettings = (olderFormats: OlderFormat[] = OLDER_FORMATS): Loaded => {
  const current = readStored(SETTINGS_KEY);
  if (current !== null) return { settings: parseSettings(current), upgraded: false };
  for (const { key, upgrade } of olderFormats) {
    const old = readStored(key);
    if (old === null) continue;
    try {
      return { settings: validateSettings(upgrade(JSON.parse(old))), upgraded: true };
    } catch {
      return { settings: { ...DEFAULTS }, upgraded: false };
    }
  }
  return { settings: { ...DEFAULTS }, upgraded: false };
};

/** Save the settings; false when storage is off or full (they still apply for this visit) */
export const saveSettings = (settings: Settings): boolean => writeStored(SETTINGS_KEY, JSON.stringify(settings));

/** textSize -> data-text-size */
export const attributeName = (key: string) => `data-${key.replace(/[A-Z]/g, c => `-${c.toLowerCase()}`)}`;

/**
 * Put every setting on <html> as a data-* attribute, which tokens.css turns
 * into values (data-text-size="large" sets --text-scale). The early script
 * in index.html does the same before the first paint; settings.test.ts
 * checks the two agree.
 */
export const applySettings = (settings: Settings, root: { setAttribute: (name: string, value: string) => void }) => {
  for (const key of KEYS) root.setAttribute(attributeName(key), String(settings[key]));
};

/** The menu bar clock's date-fns pattern: 3:45 PM, 3:45:07 PM, 15:45 or 15:45:07 */
export const clockPattern = ({ clock, clockSeconds }: Pick<Settings, 'clock' | 'clockSeconds'>) =>
  (clock === '24' ? 'HH:mm' : 'h:mm') + (clockSeconds ? ':ss' : '') + (clock === '24' ? '' : ' a');
