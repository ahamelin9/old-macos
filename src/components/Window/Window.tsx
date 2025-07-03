import React, { useState, useRef } from 'react';
import { useWindows } from '../../contexts/WindowContext';
import WindowHeader from './WindowHeader';
import './styles.css';

interface WindowProps {
  id: number;
  title: string;
  children: React.ReactNode;
  onClose?: () => void;
  initialPosition: { x: number; y: number };
  initialSize: { width: number; height: number };
  zIndex: number;
  minimized: boolean;
  maximized: boolean;
}

const Window: React.FC<WindowProps> = ({
  id,
  title,
  children,
  onClose,
  initialPosition,
  initialSize,
  zIndex,
  minimized,
  maximized
}) => {
  const [position, setPosition] = useState(initialPosition);
  const [size, setSize] = useState(initialSize);
  const [dragStartOffset, setDragStartOffset] = useState<{ x: number; y: number } | null>(null);
  const [resizeStartPos, setResizeStartPos] = useState<{ x: number; y: number } | null>(null);
  const windowRef = useRef<HTMLDivElement>(null);
  const { focusWindow, minimizeWindow, maximizeWindow, restoreWindow } = useWindows();

  const onPointerDownDrag = (e: React.PointerEvent) => {
    if (maximized) return;
    focusWindow(id);
    setDragStartOffset({ x: e.clientX - position.x, y: e.clientY - position.y });
    windowRef.current?.setPointerCapture(e.pointerId);
  };

  const onPointerDownResize = (e: React.PointerEvent) => {
    if (maximized) return;
    focusWindow(id);
    setResizeStartPos({ x: e.clientX, y: e.clientY });
    windowRef.current?.setPointerCapture(e.pointerId);
  };

  const onPointerMove = (e: React.PointerEvent) => {
    if (dragStartOffset) {
      setPosition({
        x: e.clientX - dragStartOffset.x,
        y: e.clientY - dragStartOffset.y,
      });
    } else if (resizeStartPos) {
      setSize({
        width: Math.max(300, e.clientX - position.x),
        height: Math.max(200, e.clientY - position.y),
      });
    }
  };

  const onPointerUp = (e: React.PointerEvent) => {
    setDragStartOffset(null);
    setResizeStartPos(null);
    windowRef.current?.releasePointerCapture(e.pointerId);
  };

  if (minimized) return null;

  return (
    <div
      ref={windowRef}
      className={`window ${maximized ? 'maximized' : ''}`}
      style={{
        left: `${position.x}px`,
        top: `${position.y}px`,
        width: `${size.width}px`,
        height: `${size.height}px`,
        zIndex: zIndex
      }}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
      onPointerCancel={onPointerUp}
    >
      <div
        className="window-header"
        onPointerDown={onPointerDownDrag}
      >
        <WindowHeader
          title={title}
          onClose={onClose}
          onMinimize={() => minimizeWindow(id)}
          onMaximize={() => maximized ? restoreWindow(id) : maximizeWindow(id)}
          maximized={maximized}
        />
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
