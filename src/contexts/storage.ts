// localStorage that never throws. Storage can be switched off (some private
// windows, blocked site data), and then even reading `window.localStorage`
// throws; the site must still load, so every read and write goes through
// these and falls back quietly.

/** The stored string, or null when it's missing or storage is off */
export const readStored = (key: string): string | null => {
  try {
    return window.localStorage.getItem(key);
  } catch {
    return null;
  }
};

/** Save a string; false when storage is off or full */
export const writeStored = (key: string, value: string): boolean => {
  try {
    window.localStorage.setItem(key, value);
    return true;
  } catch {
    return false;
  }
};

export const removeStored = (key: string): void => {
  try {
    window.localStorage.removeItem(key);
  } catch {
    // storage is off: nothing to remove
  }
};
