import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
// Context
import { useWindows } from '../../contexts/WindowContext';
// Apps
import Finder from '../Apps/Finder/Finder';
import NasaNews from '../Apps/NasaNews/NasaNews';
import Notes from '../Apps/Notes/Notes';
import Preferences from '../Apps/Preferences/Preferences';
import Terminal from '../Apps/Terminal/Terminal';
import Calculator from '../Apps/Calculator/Calculator';
import Trash from '../Apps/Trash/Trash';
import Music from '../Apps/Music/Music';
import Camera from "../Apps/Camera/Camera";
// Styling
import './styles.css';
const Dock = () => {
    const { windows, openWindow, restoreWindow } = useWindows();
    const apps = [
        {
            name: 'Finder',
            icon: '/finder-icon.webp',
            action: () => openWindow('Finder', _jsx(Finder, {}))
        },
        {
            name: 'Nasa News',
            icon: '/nasa-icon.png',
            action: () => openWindow('Nasa News', _jsx(NasaNews, {}))
        },
        {
            name: 'Music',
            icon: '/music-icon.png',
            action: () => openWindow('Music', _jsx(Music, {}))
        },
        {
            name: 'Notes',
            icon: '/notes-icon.png',
            action: () => openWindow('Notes', _jsx(Notes, {}))
        },
        {
          name: 'Camera',
          icon: '/camera-icon.png',
          action: () => openWindow('Camera', _jsx(Camera, {}))
      },
      {
          name: 'Calculator',
          icon: '/calculator-icon.png',
          action: () => openWindow('Calculator', _jsx(Calculator, {}))
      },
      {
          name: 'Terminal',
          icon: '/terminal-icon.png',
          action: () => openWindow('Terminal', _jsx(Terminal, {}))
      },
      {
          name: 'System Preferences',
          icon: '/preferences-icon.png',
          action: () => openWindow('Preferences', _jsx(Preferences, {}))
      },
      {
          name: 'Trash',
          icon: '/trash-icon.png',
          action: () => openWindow('Trash', _jsx(Trash, {}))
      }
    ];
    const minimizedWindows = windows.filter(w => w.minimized);
    return (_jsxs("div", { className: "dock", children: [apps.map((app, index) => (_jsxs("div", { className: "dock-item", onClick: app.action, children: [_jsx("img", { src: app.icon, alt: app.name, className: "dock-icon" }), _jsx("span", { className: "dock-label", children: app.name })] }, `app-${index}`))), minimizedWindows.map(window => (_jsxs("div", { className: "dock-item minimized-window", onClick: () => restoreWindow(window.id), children: [_jsx("div", { className: "dock-icon", children: "\uD83D\uDCC4" }), _jsx("span", { className: "dock-label", children: window.title })] }, `min-${window.id}`)))] }));
};
export default Dock;
