import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useState, useRef, useEffect } from 'react';
import { useWindows } from '../../contexts/WindowContext';
import './styles.css';
const Window = ({ id, title, children, onClose, initialPosition, initialSize, zIndex, minimized, maximized }) => {
    const [position, setPosition] = useState(initialPosition);
    const [size, setSize] = useState(initialSize);
    const [dragStartOffset, setDragStartOffset] = useState(null);
    const [resizeStartPos, setResizeStartPos] = useState(null);
    const windowRef = useRef(null);
    const { focusWindow, minimizeWindow, maximizeWindow, restoreWindow } = useWindows();
    const [prevSize, setPrevSize] = useState(null);
    const [prevPosition, setPrevPosition] = useState(null);
    const onPointerDownDrag = (e) => {
        var _a;
        if (maximized)
            return;
        if (e.target.closest('button')) {
            return;
        }
        e.preventDefault();
        focusWindow(id);
        setDragStartOffset({ x: e.clientX - position.x, y: e.clientY - position.y });
        (_a = windowRef.current) === null || _a === void 0 ? void 0 : _a.setPointerCapture(e.pointerId);
    };
    const onPointerDownResize = (e) => {
        var _a;
        if (maximized)
            return;
        e.preventDefault();
        focusWindow(id);
        setResizeStartPos({ x: e.clientX, y: e.clientY });
        (_a = windowRef.current) === null || _a === void 0 ? void 0 : _a.setPointerCapture(e.pointerId);
    };
    const onPointerMove = (e) => {
        if (dragStartOffset || resizeStartPos) {
            e.preventDefault();
        }
        if (dragStartOffset) {
            setPosition({
                x: e.clientX - dragStartOffset.x,
                y: e.clientY - dragStartOffset.y,
            });
        }
        else if (resizeStartPos) {
            setSize({
                width: Math.max(300, e.clientX - position.x),
                height: Math.max(200, e.clientY - position.y),
            });
        }
    };
    const onPointerUp = (e) => {
        var _a;
        setDragStartOffset(null);
        setResizeStartPos(null);
        (_a = windowRef.current) === null || _a === void 0 ? void 0 : _a.releasePointerCapture(e.pointerId);
    };
    if (minimized)
        return null;
    // Helper function to calculate safe desktop bounds dynamically
    const getAvailableDesktopSize = () => {
        const topMenuBarHeight = 26; // The y-offset for your top menu
        const dockElement = document.querySelector('.dock');
        // Get the true rendered height of the dock, default to 0 if not found
        const dockHeight = dockElement ? dockElement.getBoundingClientRect().height : 0;
        // Without this, the window calculates the height of the dock itself, but 
        // forgets the dock is hovering above the bottom of the screen.
        const dockHoverOffset = 12;
        // The buffer keeps the window from physically touching the dock boundary
        const buffer = 10;
        return {
            width: window.innerWidth,
            height: window.innerHeight - topMenuBarHeight - dockHeight - dockHoverOffset - buffer
        };
    };
    const handleToggleMaximize = () => {
        if (!maximized) {
            // Save current size/position
            setPrevSize(size);
            setPrevPosition(position);
            // Maximize using the dynamic calculation instead of window.innerHeight
            setPosition({ x: 0, y: 26 });
            setSize(getAvailableDesktopSize());
            maximizeWindow(id);
        }
        else {
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
                // Recalculate if the user rotates their phone or resizes the browser
                setSize(getAvailableDesktopSize());
            }
        };
        window.addEventListener('resize', handleResize);
        return () => window.removeEventListener('resize', handleResize);
    }, [maximized]);
    return (_jsxs("div", { ref: windowRef, className: `window ${maximized ? 'maximized' : ''}`, style: {
            left: `${position.x}px`,
            top: `${position.y}px`,
            width: `${size.width}px`,
            height: `${size.height}px`,
            zIndex: zIndex
        }, onPointerMove: onPointerMove, onPointerUp: onPointerUp, onPointerCancel: onPointerUp, children: [_jsxs("div", { className: "window-header", onPointerDown: onPointerDownDrag, children: [_jsxs("div", { className: "window-controls", children: [_jsx("button", { className: "window-close", onClick: onClose, "aria-label": "Close window", children: "\u00D7" }), _jsx("button", { className: "window-minimize", onClick: () => minimizeWindow(id), "aria-label": "Minimize window", children: "\u2212" }), _jsx("button", { className: "window-maximize", onClick: handleToggleMaximize, "aria-label": maximized ? "Restore window" : "Maximize window", children: maximized ? "↔" : "+" })] }), _jsx("div", { className: "window-title", children: title })] }), _jsx("div", { className: "window-content", children: children }), !maximized && (_jsx("div", { className: "window-resize-handle", onPointerDown: onPointerDownResize }))] }));
};
export default Window;
