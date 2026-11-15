// React
import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState, ReactNode } from 'react';
// Context
import { SettingsContext } from './useSettings';
import { DEFAULTS, SETTINGS_KEY, Settings, applySettings, loadSettings, saveSettings, validateSettings } from './settings';
import { removeStored } from './storage';
import { deletePicture, loadPicture, pictureProblem, savePicture, shrinkPicture } from './desktopPicture';

/**
 * System Preferences' choices for the whole site. They're read once, when
 * the site loads (the early script in index.html has already put them on
 * <html>), and every change applies at once and is saved. None of it leaves
 * the browser.
 */
export const SettingsProvider = ({ children }: { children: ReactNode }) => {
  const [loaded] = useState(loadSettings);
  const [settings, setSettings] = useState<Settings>(loaded.settings);
  const [settingsSaved, setSettingsSaved] = useState(true);
  // The latest settings, so change() can build on them without a stale closure
  const latest = useRef(settings);

  const [pictureUrl, setPictureUrl] = useState<string | null>(null);
  const [pictureLoading, setPictureLoading] = useState(true);
  const [pictureSaved, setPictureSaved] = useState(true);

  // Before the browser paints, so a change never shows half applied
  useLayoutEffect(() => {
    applySettings(settings, document.documentElement);
  }, [settings]);

  // Settings found under an older key are saved under the current one
  useEffect(() => {
    if (loaded.upgraded) saveSettings(loaded.settings);
  }, [loaded]);

  const change = useCallback((patch: Partial<Settings>) => {
    const next = validateSettings({ ...latest.current, ...patch });
    latest.current = next;
    setSettings(next);
    setSettingsSaved(saveSettings(next));
  }, []);

  /** Show a new picture (or none), letting go of the old one's object URL */
  const currentUrl = useRef<string | null>(null);
  const showPicture = useCallback((blob: Blob | null) => {
    if (currentUrl.current) URL.revokeObjectURL(currentUrl.current);
    currentUrl.current = blob ? URL.createObjectURL(blob) : null;
    setPictureUrl(currentUrl.current);
  }, []);

  // The saved picture, if any. When IndexedDB can't be used (some private
  // windows), say so in the Desktop pane: a new picture lasts only this visit.
  useEffect(() => {
    let cancelled = false;
    loadPicture()
      .then(blob => { if (!cancelled && blob) showPicture(blob); })
      .catch(() => { if (!cancelled) setPictureSaved(false); })
      .finally(() => { if (!cancelled) setPictureLoading(false); });
    return () => { cancelled = true; };
  }, [showPicture]);

  const setPicture = useCallback(async (file: File): Promise<string | null> => {
    const problem = pictureProblem(file);
    if (problem) return problem;
    let blob: Blob;
    try {
      blob = await shrinkPicture(file);
    } catch {
      return "That picture couldn't be opened. Try a JPEG or PNG.";
    }
    try {
      await savePicture(blob);
      setPictureSaved(true);
    } catch {
      setPictureSaved(false);
    }
    showPicture(blob);
    setPictureLoading(false);
    change({ wallpaper: 'custom' });
    return null;
  }, [change, showPicture]);

  const removePicture = useCallback(async () => {
    try {
      await deletePicture();
    } catch {
      // IndexedDB is off, so nothing was saved
    }
    showPicture(null);
    if (latest.current.wallpaper === 'custom') change({ wallpaper: DEFAULTS.wallpaper });
  }, [change, showPicture]);

  const restoreDefaults = useCallback(async () => {
    await removePicture();
    latest.current = { ...DEFAULTS };
    setSettings(latest.current);
    removeStored(SETTINGS_KEY);
  }, [removePicture]);

  // The visitor's own picture while it's missing (removed, or IndexedDB
  // emptied) shows the default photo instead
  const wallpaper = settings.wallpaper === 'custom' && !pictureUrl && !pictureLoading ? DEFAULTS.wallpaper : settings.wallpaper;

  const value = useMemo(() => ({
    settings,
    change,
    restoreDefaults,
    settingsSaved,
    wallpaper,
    pictureUrl,
    pictureLoading,
    pictureSaved,
    setPicture,
    removePicture
  }), [settings, change, restoreDefaults, settingsSaved, wallpaper, pictureUrl, pictureLoading, pictureSaved, setPicture, removePicture]);

  return <SettingsContext.Provider value={value}>{children}</SettingsContext.Provider>;
};
