import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
// React
import { useState, useEffect } from 'react';
// Packages
import { format } from 'date-fns';
// Components
import { useWindows } from '../../contexts/WindowContext';
import Window from '../Window/Window';
import Dock from '../Dock/Dock';
// Styling
import './styles.css';
const Desktop = () => {
    const { windows, closeWindow } = useWindows();
    const [currentTime, setCurrentTime] = useState(new Date());
    // Update time every second
    useEffect(() => {
        const timer = setInterval(() => {
            setCurrentTime(new Date());
        }, 1000);
        return () => clearInterval(timer);
    }, []);
    const sortedWindows = [...windows]
        .filter(window => window.open && !window.minimized)
        .sort((a, b) => b.zIndex - a.zIndex);
    return (_jsxs("div", { className: "desktop", style: { backgroundImage: "url(/mac-os-background.jpg)" }, children: [_jsxs("div", { className: "mac-menu-bar", children: [_jsxs("div", { className: "apple-menu", children: [_jsx("span", { className: "apple-logo", children: "\uD83C\uDF4E" }), _jsx("span", { className: "menu-item", children: "Finder" }), _jsx("span", { className: "menu-item", children: "File" }), _jsx("span", { className: "menu-item", children: "Edit" }), _jsx("span", { className: "menu-item", children: "View" }), _jsx("span", { className: "menu-item", children: "Go" }), _jsx("span", { className: "menu-item", children: "Window" }), _jsx("span", { className: "menu-item", children: "Help" })] }), _jsxs("div", { className: "menu-status", children: [_jsx("span", { className: "status-item", children: format(currentTime, 'EEE') }), _jsx("span", { className: "status-item", children: format(currentTime, 'h:mm a') })] })] }), sortedWindows.map(window => (_jsx(Window, { id: window.id, title: window.title, onClose: () => closeWindow(window.id), initialPosition: window.position, initialSize: window.size, zIndex: window.zIndex, minimized: window.minimized, maximized: window.maximized, children: window.content }, window.id))), _jsx(Dock, {})] }));
};
export default Desktop;
