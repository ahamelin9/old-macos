// React
import { createContext, useContext, useState, ReactNode } from 'react';

interface DesktopWindow {
  id: number;
  title: string;
  content: ReactNode;
  open: boolean;
  minimized: boolean;
  maximized: boolean;
  originalSize?: { width: number; height: number };
  originalPosition?: { x: number; y: number };
  position: { x: number; y: number };
  size: { width: number; height: number };
  zIndex: number;
  lastInteraction: number;
}

interface WindowContextType {
  windows: DesktopWindow[];
  closeWindow: (id: number) => void;
  openWindow: (title: string, content: ReactNode) => void;
  focusWindow: (id: number) => void;
  minimizeWindow: (id: number) => void;
  maximizeWindow: (id: number) => void;
  restoreWindow: (id: number) => void;
}

const WindowContext = createContext<WindowContextType | undefined>(undefined);

export const WindowProvider = ({ children }: { children: ReactNode }) => {
  const [windows, setWindows] = useState<DesktopWindow[]>([]);
  const [globalZIndex, setGlobalZIndex] = useState(1);

  const closeWindow = (id: number) => {
    setWindows(prev => prev.map(w => w.id === id ? {...w, open: false} : w));
  };

  const openWindow = (title: string, content: ReactNode) => {
    const newZIndex = globalZIndex + 1;
    setGlobalZIndex(newZIndex);
    
    setWindows(prev => [
      ...prev.filter(w => w.open),
      {
        id: Date.now(),
        title,
        content,
        open: true,
        minimized: false,
        maximized: false,
        position: {
          x: Math.min(window.innerWidth - 400, Math.max(0, Math.floor(Math.random() * 200) + 100)),
          y: Math.min(window.innerHeight - 300, Math.max(0, Math.floor(Math.random() * 200) + 100))
        },
        size: {
          width: 400,
          height: 300
        },
        zIndex: newZIndex,
        lastInteraction: Date.now()
      }
    ]);
  };

  const focusWindow = (id: number) => {
    const newZIndex = globalZIndex + 1;
    setGlobalZIndex(newZIndex);
    
    setWindows(prev => prev.map(w => ({
      ...w,
      zIndex: w.id === id ? newZIndex : w.zIndex,
      lastInteraction: w.id === id ? Date.now() : w.lastInteraction
    })));
  };

  const minimizeWindow = (id: number) => {
    setWindows(prev => prev.map(w => 
      w.id === id ? { ...w, minimized: true } : w
    ));
  };

  const maximizeWindow = (id: number) => {
    setWindows(prev => prev.map(w => {
      if (w.id !== id) return w;
      return {
        ...w,
        maximized: true,
        originalSize: w.size,
        originalPosition: w.position,
        position: { x: 0, y: 0 },
        size: { 
          width: window.innerWidth, 
          height: window.innerHeight 
        }
      };
    }));
  };

  const restoreWindow = (id: number) => {
    setWindows(prev => prev.map(w => {
      if (w.id !== id) return w;
      return {
        ...w,
        maximized: false,
        minimized: false,
        size: w.originalSize || { width: 400, height: 300 },
        position: w.originalPosition || {
          x: Math.min(window.innerWidth - 400, Math.max(0, Math.floor(Math.random() * 200) + 100)),
          y: Math.min(window.innerHeight - 300, Math.max(0, Math.floor(Math.random() * 200) + 100))
        }
      };
    }));
  };

  return (
    <WindowContext.Provider value={{
      windows,
      closeWindow,
      openWindow,
      focusWindow,
      minimizeWindow,
      maximizeWindow,
      restoreWindow
    }}>
      {children}
    </WindowContext.Provider>
  );
};

export const useWindows = () => {
  const context = useContext(WindowContext);
  if (!context) {
    throw new Error('useWindows must be used within a WindowProvider');
  }
  return context;
};