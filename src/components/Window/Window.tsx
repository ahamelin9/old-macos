import React, { useState, useRef, useEffect } from 'react';
import { useWindows } from '../../contexts/WindowContext';
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
  const [prevSize, setPrevSize] = useState<{ width: number; height: number } | null>(null);
  const [prevPosition, setPrevPosition] = useState<{ x: number; y: number } | null>(null);


  const onPointerDownDrag = (e: React.PointerEvent) => {
    if (maximized) return;
  
    if ((e.target as HTMLElement).closest('button')) {
      return;
    }
  
    e.preventDefault();
    focusWindow(id);
    setDragStartOffset({ x: e.clientX - position.x, y: e.clientY - position.y });
    windowRef.current?.setPointerCapture(e.pointerId);
  };
  
  const onPointerDownResize = (e: React.PointerEvent) => {
    if (maximized) return;
  
    e.preventDefault();
    focusWindow(id);
    setResizeStartPos({ x: e.clientX, y: e.clientY });
    windowRef.current?.setPointerCapture(e.pointerId);
  };  

  const onPointerMove = (e: React.PointerEvent) => {
    if (dragStartOffset || resizeStartPos) {
      e.preventDefault(); 
    }
  
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

  const handleToggleMaximize = () => {
    if (!maximized) {
      // Save current size/position
      setPrevSize(size);
      setPrevPosition(position);
  
      // Maximize
      setPosition({ x: 0, y: 26 });
      setSize({ width: window.innerWidth, height: window.innerHeight });
      maximizeWindow(id);
    } else {
      // Restore previous size/position
      if (prevSize && prevPosition) {
        setPosition(prevPosition);
        setSize(prevSize);
      }
      restoreWindow(id);
    }
  };

  useEffect(() => {
    const handleResize = () => {
      if (maximized) {
        setSize({ width: window.innerWidth, height: window.innerHeight });
      }
    };
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, [maximized]);
  
  
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
