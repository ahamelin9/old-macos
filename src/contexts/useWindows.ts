// The window manager's types, context and hook. The provider lives in
// WindowContext.tsx; keeping the hook here lets that file export only a
// component, which React Fast Refresh needs.
import { createContext, useContext, ReactNode } from 'react';
import type { AppId, AppRequest } from '../components/Apps/apps';

/** Height of the menu bar along the top of the desktop */
export const MENU_BAR_HEIGHT = 26;

export interface Point { x: number; y: number }
export interface Size { width: number; height: number }

export interface DesktopWindow {
  id: number;
  /** Which app it is (apps.ts); showApp finds an app's window by this, never by its title */
  appId?: AppId;
  title: string;
  content: ReactNode;
  /** Hidden in the Dock. It stays mounted, so the app keeps its state (Music keeps playing) */
  minimized: boolean;
  /** Counts up with each minimize, so the Dock's tiles keep the order they came in */
  minimizedAt?: number;
  maximized: boolean;
  /** Where the window is now. The context is the only source of truth. */
  position: Point;
  size: Size;
  /** The frame to go back to when a maximized window is un-maximized */
  restoreFrame?: { position: Point; size: Size };
  zIndex: number;
}

export interface WindowContextType {
  windows: DesktopWindow[];
  /** A new window with any content; prefer openApp or showApp for an app */
  openWindow: (title: string, content: ReactNode) => void;
  /** A new window of an app, whatever is already open (showApp is usually what you want) */
  openApp: (appId: AppId, request?: AppRequest) => void;
  /**
   * The app's window in front: restored if minimized, and handed `request`
   * if one is given (Preferences' pane); or a new window if it has none.
   * Which window, when there are several: planShowApp in showApp.ts
   */
  showApp: (appId: AppId, request?: AppRequest) => void;
  closeWindow: (id: number) => void;
  /** Bring to the front (no-op when it already is) */
  focusWindow: (id: number) => void;
  /** Save a frame after a drag or a resize */
  setWindowFrame: (id: number, position: Point, size: Size) => void;
  /** Hide it in the Dock; it stays mounted (Desktop.tsx, Window.tsx) */
  minimizeWindow: (id: number) => void;
  /** Un-minimize, keeping its frame and maximized state, and bring it to the front */
  restoreWindow: (id: number) => void;
  /** Maximize to the given frame, remembering the current one */
  maximizeWindow: (id: number, position: Point, size: Size) => void;
  /** Go back to the frame from before maximizing */
  unmaximizeWindow: (id: number) => void;
}

export const WindowContext = createContext<WindowContextType | undefined>(undefined);

export const useWindows = () => {
  const context = useContext(WindowContext);
  if (!context) {
    throw new Error('useWindows must be used within a WindowProvider');
  }
  return context;
};

/** What an app can know about its own window. Window.tsx provides it. */
export interface OwnWindow {
  /** Hidden in the Dock. Camera turns the webcam off while it is */
  minimized: boolean;
}

export const OwnWindowContext = createContext<OwnWindow>({ minimized: false });

/** The app's own window: whether it is minimized */
export const useOwnWindow = () => useContext(OwnWindowContext);
