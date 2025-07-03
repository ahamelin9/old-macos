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
import Camera from '../Apps/Camera/Camera';
// Styling
import './styles.css';
import { useEffect, useState } from 'react';

const Dock = () => {
  const { windows, openWindow, restoreWindow } = useWindows();
  const [isMobile, setIsMobile] = useState(window.innerWidth < 600);

  useEffect(() => {
    const handleResize = () => {
      setIsMobile(window.innerWidth < 600);
    };

    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  const apps = [
    { 
      name: 'Finder', 
      icon: '/finder-icon.webp',
      action: () => openWindow('Finder', <Finder />)
    },
    { 
      name: 'Nasa News', 
      icon: '/nasa-icon.png',
      action: () => openWindow('Nasa News', <NasaNews />)
    },
    { 
      name: 'Music', 
      icon: '/music-icon.png',
      action: () => openWindow('Music', <Music />)
    },
    { 
      name: 'Notes', 
      icon: '/notes-icon.png',
      action: () => openWindow('Notes', <Notes />)
    },
    {
      name: 'Camera',
      icon: '/camera-icon.png',
      action: () => openWindow('Camera', <Camera />)
    },
    { 
      name: 'Calculator', 
      icon: '/calculator-icon.png',
      action: () => openWindow('Calculator', <Calculator />)
    },
    { 
      name: 'Terminal', 
      icon: '/terminal-icon.png',
      action: () => openWindow('Terminal', <Terminal />)
    },
    { 
      name: 'System Preferences', 
      icon: '/preferences-icon.png',
      action: () => openWindow('Preferences', <Preferences />)
    },
    { 
      name: 'Trash', 
      icon: '/trash-icon.png',
      action: () => openWindow('Trash', <Trash />)
    }
  ];

  // Choose which apps to show on mobile
  const visibleApps = isMobile
    ? apps.filter(app => 
        ['Finder', 'Nasa News', 'Music', 'Terminal'].includes(app.name)
      )
    : apps;

  const minimizedWindows = windows.filter(w => w.minimized);

  return (
    <div className="dock">
      {visibleApps.map((app, index) => (
        <div 
          key={`app-${index}`}
          className="dock-item"
          onClick={app.action}
        >
          <img src={app.icon} alt={app.name} className="dock-icon" />
          <span className="dock-label">{app.name}</span>
        </div>
      ))}

      {minimizedWindows.map(window => (
        <div 
          key={`min-${window.id}`}
          className="dock-item minimized-window"
          onClick={() => restoreWindow(window.id)}
        >
          <div className="dock-icon">📄</div>
          <span className="dock-label">{window.title}</span>
        </div>
      ))}
    </div>
  );
};

export default Dock;
