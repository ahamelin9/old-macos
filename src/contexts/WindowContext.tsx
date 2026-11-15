// React
import { useCallback, useLayoutEffect, useMemo, useRef, useState, ReactNode } from 'react';
// Context
import { DesktopWindow, MENU_BAR_HEIGHT, Point, Size, WindowContext } from './useWindows';
import { planShowApp } from './showApp';
// Apps
import { appInfo, type AppId, type AppRequest } from '../components/Apps/apps';
import { launchApp } from '../components/Apps/launch';

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
  // Numbers each request an app is handed, so the same request twice still counts
  const nextRequest = useRef(1);
  // The windows as last drawn, for showApp to decide from (a state updater must stay pure)
  const latest = useRef(windows);
  useLayoutEffect(() => {
    latest.current = windows;
  }, [windows]);

  const update = useCallback((id: number, change: (w: DesktopWindow) => Partial<DesktopWindow>) => {
    setWindows(prev => prev.map(w => (w.id === id ? { ...w, ...change(w) } : w)));
  }, []);

  const open = useCallback((title: string, content: ReactNode, appId?: AppId) => {
    const id = nextId.current++;
    const frame = initialFrame();
    setWindows(prev => [
      ...prev,
      { id, appId, title, content, minimized: false, maximized: false, zIndex: frontZ(prev), ...frame }
    ]);
  }, []);

  const openWindow = useCallback((title: string, content: ReactNode) => open(title, content), [open]);

  const openApp = useCallback((appId: AppId, request?: AppRequest) => {
    open(appInfo(appId).title, launchApp(appId, request, request && nextRequest.current++), appId);
  }, [open]);

  const showApp = useCallback((appId: AppId, request?: AppRequest) => {
    const plan = planShowApp(latest.current, appId);
    if (plan.kind === 'open') {
      openApp(appId, request);
      return;
    }
    if (plan.inFront && !request) return;
    // A request reaches an open window as new props on the same component,
    // which keeps its state (Preferences switches pane, nothing else resets)
    const content = request ? launchApp(appId, request, nextRequest.current++) : null;
    setWindows(prev => {
      const zIndex = plan.inFront ? undefined : frontZ(prev);
      return prev.map(w => (w.id === plan.id
        ? { ...w, minimized: false, ...(zIndex ? { zIndex } : {}), ...(content ? { content } : {}) }
        : w));
    });
  }, [openApp]);

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

  // Numbers each minimize, so the Dock keeps its tiles in the order they came in
  const nextMinimize = useRef(1);
  const minimizeWindow = useCallback((id: number) => {
    const order = nextMinimize.current++;
    update(id, w => (w.minimized ? {} : { minimized: true, minimizedAt: order }));
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
    openApp,
    showApp,
    closeWindow,
    focusWindow,
    setWindowFrame,
    minimizeWindow,
    restoreWindow,
    maximizeWindow,
    unmaximizeWindow
  }), [windows, openWindow, openApp, showApp, closeWindow, focusWindow, setWindowFrame, minimizeWindow, restoreWindow, maximizeWindow, unmaximizeWindow]);

  return <WindowContext.Provider value={value}>{children}</WindowContext.Provider>;
};
