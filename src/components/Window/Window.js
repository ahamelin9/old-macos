import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
// React
import { useState, useRef, useEffect } from 'react';
// Context
import { useWindows } from '../../contexts/WindowContext';
// Sub Components
import WindowHeader from './WindowHeader';
// Styling
import './styles.css';
const Window = ({ id, title, children, onClose, initialPosition, initialSize, zIndex, minimized, maximized }) => {
    const [position, setPosition] = useState(initialPosition);
    const [size, setSize] = useState(initialSize);
    const [isDragging, setIsDragging] = useState(false);
    const [isResizing, setIsResizing] = useState(false);
    const [startPos, setStartPos] = useState({ x: 0, y: 0 });
    const windowRef = useRef(null);
    const { focusWindow, minimizeWindow, maximizeWindow, restoreWindow } = useWindows();
    const handleInteraction = () => {
        focusWindow(id);
    };
    const handleMouseDown = (e) => {
        handleInteraction();
        if (e.target.closest('.window-header') && !maximized) {
            setIsDragging(true);
            setStartPos({ x: e.clientX - position.x, y: e.clientY - position.y });
            e.stopPropagation();
        }
    };
    const handleMouseMove = (e) => {
        if (isDragging && !maximized) {
            setPosition({
                x: e.clientX - startPos.x,
                y: e.clientY - startPos.y
            });
        }
        else if (isResizing && !maximized) {
            const newWidth = Math.max(300, e.clientX - position.x);
            const newHeight = Math.max(200, e.clientY - position.y);
            setSize({ width: newWidth, height: newHeight });
        }
    };
    const handleMouseUp = () => {
        setIsDragging(false);
        setIsResizing(false);
    };
    const handleResizeMouseDown = (e) => {
        if (maximized)
            return;
        handleInteraction();
        e.stopPropagation();
        setIsResizing(true);
        setStartPos({ x: e.clientX, y: e.clientY });
    };
    const handleMinimize = () => {
        minimizeWindow(id);
    };
    const handleMaximize = () => {
        if (maximized) {
            restoreWindow(id);
        }
        else {
            maximizeWindow(id);
        }
    };
    useEffect(() => {
        document.addEventListener('mousemove', handleMouseMove);
        document.addEventListener('mouseup', handleMouseUp);
        return () => {
            document.removeEventListener('mousemove', handleMouseMove);
            document.removeEventListener('mouseup', handleMouseUp);
        };
    }, [isDragging, isResizing, startPos, maximized]);
    if (minimized)
        return null;
    return (_jsxs("div", { ref: windowRef, className: `window ${isDragging ? 'dragging' : ''} ${maximized ? 'maximized' : ''}`, style: {
            left: `${position.x}px`,
            top: `${position.y}px`,
            width: `${size.width}px`,
            height: `${size.height}px`,
            zIndex: zIndex
        }, onMouseDown: handleMouseDown, onClick: handleInteraction, children: [_jsx(WindowHeader, { title: title, onClose: onClose, onMinimize: handleMinimize, onMaximize: handleMaximize, maximized: maximized }), _jsx("div", { className: "window-content", children: children }), !maximized && (_jsx("div", { className: "window-resize-handle", onMouseDown: handleResizeMouseDown }))] }));
};
export default Window;
