// The window manager's types, context and hook. The provider lives in
// WindowContext.tsx; keeping the hook here lets that file export only a
// component, which React Fast Refresh needs.
import { createContext, useContext, ReactNode } from 'react';

/** Height of the menu bar along the top of the desktop */
export const MENU_BAR_HEIGHT = 26;

export interface Point { x: number; y: number }
export interface Size { width: number; height: number }

export interface DesktopWindow {
  id: number;
  title: string;
  content: ReactNode;
  minimized: boolean;
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
  openWindow: (title: string, content: ReactNode) => void;
  closeWindow: (id: number) => void;
  /** Bring to the front (no-op when it already is) */
  focusWindow: (id: number) => void;
  /** Save a frame after a drag or a resize */
  setWindowFrame: (id: number, position: Point, size: Size) => void;
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
