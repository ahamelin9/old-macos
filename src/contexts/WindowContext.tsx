// React
import { useCallback, useMemo, useRef, useState, ReactNode } from 'react';
// Context
import { DesktopWindow, MENU_BAR_HEIGHT, Point, Size, WindowContext } from './useWindows';

const DEFAULT_SIZE: Size = { width: 400, height: 300 };
const EDGE_MARGIN = 8;

/**
 * Where a new window opens: a random spot near the top left on a desktop, but
 * always fully on screen, shrinking to fit a phone (a 400px window used to
 * open 10px off the left edge of a 390px phone, hiding its close button).
 */
const initialFrame = (): { position: Point; size: Size } => {
  const width = Math.min(DEFAULT_SIZE.width, window.innerWidth - EDGE_MARGIN * 2);
  const height = Math.min(DEFAULT_SIZE.height, window.innerHeight - MENU_BAR_HEIGHT - EDGE_MARGIN * 2);
  const clamp = (value: number, min: number, max: number) => Math.max(min, Math.min(value, max));
  const random = () => Math.floor(Math.random() * 200) + 100;
  return {
    position: {
      x: clamp(random(), EDGE_MARGIN, window.innerWidth - width - EDGE_MARGIN),
      y: clamp(random(), MENU_BAR_HEIGHT + EDGE_MARGIN, window.innerHeight - height - EDGE_MARGIN)
    },
    size: { width, height }
  };
};

/** The z-index that puts a window in front of all the others */
const frontZ = (windows: DesktopWindow[]) => Math.max(1, ...windows.map(w => w.zIndex)) + 1;

export const WindowProvider = ({ children }: { children: ReactNode }) => {
  const [windows, setWindows] = useState<DesktopWindow[]>([]);
  const nextId = useRef(1);

  const update = useCallback((id: number, change: (w: DesktopWindow) => Partial<DesktopWindow>) => {
    setWindows(prev => prev.map(w => (w.id === id ? { ...w, ...change(w) } : w)));
  }, []);

  const openWindow = useCallback((title: string, content: ReactNode) => {
    const id = nextId.current++;
    const frame = initialFrame();
    setWindows(prev => [
      ...prev,
      { id, title, content, minimized: false, maximized: false, zIndex: frontZ(prev), ...frame }
    ]);
  }, []);

  const closeWindow = useCallback((id: number) => {
    setWindows(prev => prev.filter(w => w.id !== id));
  }, []);

  const focusWindow = useCallback((id: number) => {
    setWindows(prev => {
      const target = prev.find(w => w.id === id);
      // Already in front: return the same array so nothing re-renders
      if (!target || prev.every(w => w === target || w.zIndex < target.zIndex)) return prev;
      const zIndex = frontZ(prev);
      return prev.map(w => (w.id === id ? { ...w, zIndex } : w));
    });
  }, []);

  const setWindowFrame = useCallback((id: number, position: Point, size: Size) => {
    update(id, () => ({ position, size }));
  }, [update]);

  const minimizeWindow = useCallback((id: number) => {
    update(id, () => ({ minimized: true }));
  }, [update]);

  const restoreWindow = useCallback((id: number) => {
    setWindows(prev => {
      const zIndex = frontZ(prev);
      return prev.map(w => (w.id === id ? { ...w, minimized: false, zIndex } : w));
    });
  }, []);

  const maximizeWindow = useCallback((id: number, position: Point, size: Size) => {
    update(id, w => ({
      maximized: true,
      restoreFrame: w.maximized ? w.restoreFrame : { position: w.position, size: w.size },
      position,
      size
    }));
  }, [update]);

  const unmaximizeWindow = useCallback((id: number) => {
    update(id, w => ({
      maximized: false,
      restoreFrame: undefined,
      ...(w.restoreFrame ?? initialFrame())
    }));
  }, [update]);

  const value = useMemo(() => ({
    windows,
    openWindow,
    closeWindow,
    focusWindow,
    setWindowFrame,
    minimizeWindow,
    restoreWindow,
    maximizeWindow,
    unmaximizeWindow
  }), [windows, openWindow, closeWindow, focusWindow, setWindowFrame, minimizeWindow, restoreWindow, maximizeWindow, unmaximizeWindow]);

  return <WindowContext.Provider value={value}>{children}</WindowContext.Provider>;
};
