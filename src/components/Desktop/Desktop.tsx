// React
import { useState, useEffect } from 'react';
// Packages
import { format } from 'date-fns';
// Components
import { useWindows } from '../../contexts/useWindows';
import { useSpotify } from '../../contexts/useSpotify';
import Window from '../Window/Window';
import Dock from '../Dock/Dock';
// Styling
import './styles.css';

const Desktop = () => {
  const { windows, closeWindow } = useWindows();
  const { accessToken, logout } = useSpotify();
  const [currentTime, setCurrentTime] = useState(new Date());

  // Update time every second
  useEffect(() => {
    const timer = setInterval(() => {
      setCurrentTime(new Date());
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  // Stacking comes from each window's z-index, so the DOM order stays put
  // (reordering it on every click would move live content like the camera)
  const visibleWindows = windows.filter(window => !window.minimized);

  return (
    <div className="desktop" style={{ backgroundImage: "url(/mac-os-background.jpg)" }}>
      <div className="mac-menu-bar">
        <div className="apple-menu">
          <span className="apple-logo">🍎</span>
          <span className="menu-item">Finder</span>
          <span className="menu-item">File</span>
          <span className="menu-item">Edit</span>
          <span className="menu-item">View</span>
          <span className="menu-item">Go</span>
          <span className="menu-item">Window</span>
          <span className="menu-item">Help</span>
          {accessToken && (
            <span className="menu-item menu-item-spotify" onClick={logout}>
              Disconnect Spotify
            </span>
          )}
        </div>
        <div className="menu-status">
          <span className="status-item">{format(currentTime, 'EEE')}</span>
          <span className="status-item">{format(currentTime, 'h:mm a')}</span>
        </div>
      </div>
      
      {visibleWindows.map(window => (
        <Window
          key={window.id}
          id={window.id}
          title={window.title}
          onClose={() => closeWindow(window.id)}
          position={window.position}
          size={window.size}
          zIndex={window.zIndex}
          maximized={window.maximized}
        >
          {window.content}
        </Window>
      ))}
      
      <Dock />
    </div>
  );
};

export default Desktop;