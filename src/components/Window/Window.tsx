import React, { useState, useRef, useEffect } from 'react';
import { useWindows, MENU_BAR_HEIGHT, Point, Size } from '../../contexts/useWindows';
import './styles.css';

interface WindowProps {
  id: number;
  title: string;
  children: React.ReactNode;
  onClose?: () => void;
  position: Point;
  size: Size;
  zIndex: number;
  maximized: boolean;
}

const MIN_SIZE: Size = { width: 300, height: 200 };

/** The space between the menu bar and the dock, which floats over the desktop */
const availableDesktopSize = (): Size => {
  const dockElement = document.querySelector('.dock');
  const dockHeight = dockElement ? dockElement.getBoundingClientRect().height : 0;
  // The dock floats this far above the bottom of the screen
  const dockHoverOffset = 12;
  // Keeps the window from touching the dock
  const buffer = 10;
  return {
    width: window.innerWidth,
    height: window.innerHeight - MENU_BAR_HEIGHT - dockHeight - dockHoverOffset - buffer
  };
};

interface Gesture {
  kind: 'move' | 'resize';
  pointerX: number;
  pointerY: number;
  position: Point;
  size: Size;
}

/**
 * A desktop window. Its frame lives in the window context; while a drag or
 * resize is under way the live frame is kept here and saved to the context
 * when the pointer is released, so the window keeps its place through
 * minimize, restore and maximize.
 */
const Window: React.FC<WindowProps> = ({
  id,
  title,
  children,
  onClose,
  position,
  size,
  zIndex,
  maximized
}) => {
  const windowRef = useRef<HTMLDivElement>(null);
  const gesture = useRef<Gesture | null>(null);
  const [liveFrame, setLiveFrame] = useState<{ position: Point; size: Size } | null>(null);
  const { focusWindow, setWindowFrame, minimizeWindow, maximizeWindow, unmaximizeWindow } = useWindows();

  const frame = liveFrame ?? { position, size };

  const startGesture = (kind: Gesture['kind'], e: React.PointerEvent) => {
    e.preventDefault();
    gesture.current = { kind, pointerX: e.clientX, pointerY: e.clientY, position, size };
    windowRef.current?.setPointerCapture(e.pointerId);
  };

  const onPointerDownDrag = (e: React.PointerEvent) => {
    if (maximized || (e.target as HTMLElement).closest('button')) return;
    startGesture('move', e);
  };

  const onPointerDownResize = (e: React.PointerEvent) => {
    if (maximized) return;
    startGesture('resize', e);
  };

  const onPointerMove = (e: React.PointerEvent) => {
    const g = gesture.current;
    if (!g) return;
    e.preventDefault();
    const dx = e.clientX - g.pointerX;
    const dy = e.clientY - g.pointerY;
    if (g.kind === 'move') {
      setLiveFrame({ position: { x: g.position.x + dx, y: g.position.y + dy }, size: g.size });
    } else {
      setLiveFrame({
        position: g.position,
        size: {
          width: Math.max(MIN_SIZE.width, g.size.width + dx),
          height: Math.max(MIN_SIZE.height, g.size.height + dy)
        }
      });
    }
  };

  const onPointerUp = (e: React.PointerEvent) => {
    if (!gesture.current) return;
    gesture.current = null;
    if (liveFrame) setWindowFrame(id, liveFrame.position, liveFrame.size);
    setLiveFrame(null);
    if (windowRef.current?.hasPointerCapture(e.pointerId)) {
      windowRef.current.releasePointerCapture(e.pointerId);
    }
  };

  const handleToggleMaximize = () => {
    if (maximized) {
      unmaximizeWindow(id);
    } else {
      maximizeWindow(id, { x: 0, y: MENU_BAR_HEIGHT }, availableDesktopSize());
    }
  };

  // A maximized window follows the browser's size (a phone turning, say),
  // including any change while it was minimized
  useEffect(() => {
    if (!maximized) return;
    const fit = () => setWindowFrame(id, { x: 0, y: MENU_BAR_HEIGHT }, availableDesktopSize());
    fit();
    window.addEventListener('resize', fit);
    return () => window.removeEventListener('resize', fit);
  }, [maximized, id, setWindowFrame]);

  return (
    <div
      ref={windowRef}
      className={`window ${maximized ? 'maximized' : ''}`}
      style={{
        left: `${frame.position.x}px`,
        top: `${frame.position.y}px`,
        width: `${frame.size.width}px`,
        height: `${frame.size.height}px`,
        zIndex
      }}
      // Any press inside the window brings it to the front, as on a Mac
      onPointerDownCapture={() => focusWindow(id)}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
      onPointerCancel={onPointerUp}
    >
      <div className="window-header" onPointerDown={onPointerDownDrag}>
        <div className="window-controls">
          <button
            className="window-close"
            onClick={onClose}
            aria-label="Close window"
          >
            ×
          </button>
          <button
            className="window-minimize"
            onClick={() => minimizeWindow(id)}
            aria-label="Minimize window"
          >
            −
          </button>
          <button
            className="window-maximize"
            onClick={handleToggleMaximize}
            aria-label={maximized ? "Restore window" : "Maximize window"}
          >
            {maximized ? "↔" : "+"}
          </button>
        </div>
        <div className="window-title">{title}</div>
      </div>

      <div className="window-content">
        {children}
      </div>

      {!maximized && (
        <div
          className="window-resize-handle"
          onPointerDown={onPointerDownResize}
        />
      )}
    </div>
  );
};

export default Window;
