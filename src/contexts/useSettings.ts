// System Preferences' types, context and hook. The provider lives in
// SettingsContext.tsx; keeping the hook here lets that file export only a
// component, which React Fast Refresh needs.
import { createContext, useContext } from 'react';
import type { Settings, WallpaperId } from './settings';

export interface SettingsContextType {
  settings: Settings;
  /** Change some settings: they apply at once, everywhere, and are saved */
  change: (patch: Partial<Settings>) => void;
  /** Every setting back to its default, and the visitor's picture removed */
  restoreDefaults: () => Promise<void>;
  /** False when localStorage is off: changes then last only this visit */
  settingsSaved: boolean;

  /** The desktop picture to show: the chosen one, or Photo while the visitor's own is missing */
  wallpaper: WallpaperId;
  /** An object URL for the visitor's own picture, or null */
  pictureUrl: string | null;
  /** True until IndexedDB has said whether there is a saved picture */
  pictureLoading: boolean;
  /** False when IndexedDB is unavailable, so a picture lasts only this visit */
  pictureSaved: boolean;
  /** Check, shrink and keep a picture file, and make it the desktop. Resolves to a message for the visitor when it can't */
  setPicture: (file: File) => Promise<string | null>;
  removePicture: () => Promise<void>;
}

export const SettingsContext = createContext<SettingsContextType | undefined>(undefined);

export const useSettings = () => {
  const context = useContext(SettingsContext);
  if (!context) {
    throw new Error('useSettings must be used within a SettingsProvider');
  }
  return context;
};
