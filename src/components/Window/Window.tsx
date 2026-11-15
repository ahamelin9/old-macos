import React, { useState, useRef, useEffect, useLayoutEffect, useMemo } from 'react';
import { useWindows, MENU_BAR_HEIGHT, OwnWindowContext, Point, Size } from '../../contexts/useWindows';
import { FALLBACK_SCALE, scaleToTile } from './scale';
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
  /** Hidden in the Dock, but still mounted, so the app keeps its state */
  minimized: boolean;
  /** The front window: its buttons are in colour, the others' are grey until hovered */
  active: boolean;
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
 *
 * A minimized window stays mounted, hidden (`window-minimized`: invisible,
 * inert and aria-hidden), so its app keeps its state. The Scale effect
 * shrinks it into its tile in the Dock and grows it back out: this file aims
 * it (--window-to-dock), styles.css runs it.
 */
const Window: React.FC<WindowProps> = ({
  id,
  title,
  children,
  onClose,
  position,
  size,
  zIndex,
  maximized,
  minimized,
  active
}) => {
  const windowRef = useRef<HTMLDivElement>(null);
  const gesture = useRef<Gesture | null>(null);
  const [liveFrame, setLiveFrame] = useState<{ position: Point; size: Size } | null>(null);
  const { windows, focusWindow, setWindowFrame, minimizeWindow, maximizeWindow, unmaximizeWindow } = useWindows();

  const frame = liveFrame ?? { position, size };

  const startGesture = (kind: Gesture['kind'], e: React.PointerEvent) => {
    e.preventDefault();
    gesture.current = { kind, pointerX: e.clientX, pointerY: e.clientY, position, size };
    // Captured by the title bar (or the handle), not the whole window, so a
    // double-click still lands on the title bar
    e.currentTarget.setPointerCapture(e.pointerId);
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
    const captor = e.target as Element;
    if (captor.hasPointerCapture?.(e.pointerId)) captor.releasePointerCapture(e.pointerId);
  };

  // Double-clicking the title bar minimizes, as in Mac OS X (not on its buttons)
  const onTitleBarDoubleClick = (e: React.MouseEvent) => {
    if ((e.target as HTMLElement).closest('button')) return;
    minimizeWindow(id);
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

  // Aim the Scale effect at this window's tile in the Dock. The Dock draws
  // the tile in the same render (it comes first in the desktop, so it has
  // already fitted itself to the screen). Aimed again while minimized when
  // other tiles come or go, or the screen changes, so a restore grows from
  // where the tile is now.
  const minimizedIds = windows.filter(w => w.minimized).map(w => w.id).join(' ');
  useLayoutEffect(() => {
    const el = windowRef.current;
    if (!minimized || !el) return;
    const aim = () => {
      const tile = document.querySelector(`.dock [data-window-ids~="${id}"] .dock-icon`)?.getBoundingClientRect();
      // The desktop sits at the top left of the screen, so the window's own
      // offsets (untouched by its transform) are screen coordinates
      const box = { left: el.offsetLeft, top: el.offsetTop, width: el.offsetWidth, height: el.offsetHeight };
      el.style.setProperty('--window-to-dock', tile ? scaleToTile(box, tile) : FALLBACK_SCALE);
    };
    aim();
    let frame = 0;
    const onResize = () => {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(aim);
    };
    window.addEventListener('resize', onResize);
    return () => {
      cancelAnimationFrame(frame);
      window.removeEventListener('resize', onResize);
    };
  }, [minimized, id, minimizedIds]);

  // What the app can know about its window (useOwnWindow)
  const own = useMemo(() => ({ minimized }), [minimized]);

  return (
    <div
      ref={windowRef}
      className={['window', maximized && 'maximized', minimized && 'window-minimized', active && 'window-active'].filter(Boolean).join(' ')}
      data-window-id={id}
      inert={minimized}
      aria-hidden={minimized || undefined}
      style={{
        left: `${frame.position.x}px`,
        top: `${frame.position.y}px`,
        width: `${frame.size.width}px`,
        height: `${frame.size.height}px`,
        // A minimized one leaves its place in the stack to styles.css (above
        // the windows, under the Dock, while it shrinks), so it never counts as the front one
        zIndex: minimized ? undefined : zIndex
      }}
      // Any press inside the window brings it to the front, as on a Mac
      onPointerDownCapture={() => focusWindow(id)}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
      onPointerCancel={onPointerUp}
    >
      <div className="window-header" onPointerDown={onPointerDownDrag} onDoubleClick={onTitleBarDoubleClick}>
        {/* Aqua gems; their ×, − and + are drawn in styles.css and show while
            the pointer is over the group, as in Mac OS X */}
        <div className="window-controls">
          <button className="window-close" onClick={onClose} aria-label="Close window" />
          <button className="window-minimize" onClick={() => minimizeWindow(id)} aria-label="Minimize window" />
          <button
            className="window-maximize"
            onClick={handleToggleMaximize}
            aria-label={maximized ? 'Restore window' : 'Maximize window'}
          />
        </div>
        <div className="window-title">{title}</div>
      </div>

      <div className="window-content">
        <OwnWindowContext.Provider value={own}>{children}</OwnWindowContext.Provider>
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
