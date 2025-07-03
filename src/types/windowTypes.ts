// React
import { ReactNode } from 'react';

export interface DesktopWindow {
  id: number;
  title: string;
  content: ReactNode;
  open: boolean;
  position: { x: number; y: number };
  size: { width: number; height: number };
}

export interface WindowManagerContextType {
  windows: DesktopWindow[];
  closeWindow: (id: number) => void;
  openWindow: (title: string, content: ReactNode) => void;
  focusWindow: (id: number) => void;
}