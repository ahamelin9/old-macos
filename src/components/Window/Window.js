import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useState, useRef } from 'react';
import { useWindows } from '../../contexts/WindowContext';
import WindowHeader from './WindowHeader';
import './styles.css';
const Window = ({ id, title, children, onClose, initialPosition, initialSize, zIndex, minimized, maximized }) => {
    const [position, setPosition] = useState(initialPosition);
    const [size, setSize] = useState(initialSize);
    const [dragStartOffset, setDragStartOffset] = useState(null);
    const [resizeStartPos, setResizeStartPos] = useState(null);
    const windowRef = useRef(null);
    const { focusWindow, minimizeWindow, maximizeWindow, restoreWindow } = useWindows();
    const onPointerDownDrag = (e) => {
        var _a;
        if (maximized)
            return;
        focusWindow(id);
        setDragStartOffset({ x: e.clientX - position.x, y: e.clientY - position.y });
        (_a = windowRef.current) === null || _a === void 0 ? void 0 : _a.setPointerCapture(e.pointerId);
    };
    const onPointerDownResize = (e) => {
        var _a;
        if (maximized)
            return;
        focusWindow(id);
        setResizeStartPos({ x: e.clientX, y: e.clientY });
        (_a = windowRef.current) === null || _a === void 0 ? void 0 : _a.setPointerCapture(e.pointerId);
    };
    const onPointerMove = (e) => {
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
    return (_jsxs("div", { ref: windowRef, className: `window ${maximized ? 'maximized' : ''}`, style: {
            left: `${position.x}px`,
            top: `${position.y}px`,
            width: `${size.width}px`,
            height: `${size.height}px`,
            zIndex: zIndex
        }, onPointerMove: onPointerMove, onPointerUp: onPointerUp, onPointerCancel: onPointerUp, children: [_jsx("div", { className: "window-header", onPointerDown: onPointerDownDrag, children: _jsx(WindowHeader, { title: title, onClose: onClose, onMinimize: () => minimizeWindow(id), onMaximize: () => maximized ? restoreWindow(id) : maximizeWindow(id), maximized: maximized }) }), _jsx("div", { className: "window-content", children: children }), !maximized && (_jsx("div", { className: "window-resize-handle", onPointerDown: onPointerDownResize }))] }));
};
export default Window;
