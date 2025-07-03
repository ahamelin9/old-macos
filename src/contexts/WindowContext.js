import { jsx as _jsx } from "react/jsx-runtime";
// React
import { createContext, useContext, useState } from 'react';
const WindowContext = createContext(undefined);
export const WindowProvider = ({ children }) => {
    const [windows, setWindows] = useState([]);
    const [globalZIndex, setGlobalZIndex] = useState(1);
    const closeWindow = (id) => {
        setWindows(prev => prev.map(w => w.id === id ? Object.assign(Object.assign({}, w), { open: false }) : w));
    };
    const openWindow = (title, content) => {
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
    const focusWindow = (id) => {
        const newZIndex = globalZIndex + 1;
        setGlobalZIndex(newZIndex);
        setWindows(prev => prev.map(w => (Object.assign(Object.assign({}, w), { zIndex: w.id === id ? newZIndex : w.zIndex, lastInteraction: w.id === id ? Date.now() : w.lastInteraction }))));
    };
    const minimizeWindow = (id) => {
        setWindows(prev => prev.map(w => w.id === id ? Object.assign(Object.assign({}, w), { minimized: true }) : w));
    };
    const maximizeWindow = (id) => {
        setWindows(prev => prev.map(w => {
            if (w.id !== id)
                return w;
            return Object.assign(Object.assign({}, w), { maximized: true, originalSize: w.size, originalPosition: w.position, position: { x: 0, y: 0 }, size: {
                    width: window.innerWidth,
                    height: window.innerHeight
                } });
        }));
    };
    const restoreWindow = (id) => {
        setWindows(prev => prev.map(w => {
            if (w.id !== id)
                return w;
            return Object.assign(Object.assign({}, w), { maximized: false, minimized: false, size: w.originalSize || { width: 400, height: 300 }, position: w.originalPosition || {
                    x: Math.min(window.innerWidth - 400, Math.max(0, Math.floor(Math.random() * 200) + 100)),
                    y: Math.min(window.innerHeight - 300, Math.max(0, Math.floor(Math.random() * 200) + 100))
                } });
        }));
    };
    return (_jsx(WindowContext.Provider, { value: {
            windows,
            closeWindow,
            openWindow,
            focusWindow,
            minimizeWindow,
            maximizeWindow,
            restoreWindow
        }, children: children }));
};
export const useWindows = () => {
    const context = useContext(WindowContext);
    if (!context) {
        throw new Error('useWindows must be used within a WindowProvider');
    }
    return context;
};
