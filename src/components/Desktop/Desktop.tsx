// React
import { useState, useEffect } from 'react';
// Packages
import { format } from 'date-fns';
// Components
import { useWindows } from '../../contexts/useWindows';
import { useSpotify } from '../../contexts/useSpotify';
import { useSettings } from '../../contexts/useSettings';
import { clockPattern } from '../../contexts/settings';
import Window from '../Window/Window';
import Dock from '../Dock/Dock';
import AppleMenu from './AppleMenu';
import RestartAlert from './RestartAlert';
import SleepScreen from './SleepScreen';
// Styling
import './styles.css';

const Desktop = () => {
  const { windows, closeWindow } = useWindows();
  const { accessToken, logout } = useSpotify();
  const { settings, wallpaper, pictureUrl } = useSettings();
  const [currentTime, setCurrentTime] = useState(new Date());
  // The Apple menu's Sleep and Restart…
  const [asleep, setAsleep] = useState(false);
  const [askingRestart, setAskingRestart] = useState(false);
  const [restarting, setRestarting] = useState(false);

  // Update time every second
  useEffect(() => {
    const timer = setInterval(() => {
      setCurrentTime(new Date());
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  // Every window is drawn, minimized ones too (hidden, so their apps keep
  // their state). Stacking comes from each window's z-index, so the DOM order
  // stays put (reordering it on every click would move live content like the
  // camera). The front window is the highest one showing.
  const front = windows.reduce<(typeof windows)[number] | undefined>(
    (top, w) => (!w.minimized && (!top || w.zIndex > top.zIndex) ? w : top),
    undefined
  );

  // The chosen desktop picture (tokens.css, --wallpaper-*). The visitor's own
  // picture shows as plain colour until IndexedDB hands it back.
  const background = wallpaper === 'custom' && pictureUrl
    ? `url(${pictureUrl}) var(--wallpaper-custom)`
    : `var(--wallpaper-${wallpaper})`;

  return (
    <div className="desktop" style={{ background }}>
      <div className="mac-menu-bar">
        <div className="apple-menu">
          <AppleMenu onSleep={() => setAsleep(true)} onRestart={() => setAskingRestart(true)} />
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
          <span className="status-item">{format(currentTime, clockPattern(settings))}</span>
        </div>
      </div>
      
      {/* The Dock comes first, so it has fitted itself to the screen before a
          window aims its Scale effect at a tile in it (Window.tsx) */}
      <Dock />

      {windows.map(window => (
        <Window
          key={window.id}
          id={window.id}
          title={window.title}
          onClose={() => closeWindow(window.id)}
          position={window.position}
          size={window.size}
          zIndex={window.zIndex}
          maximized={window.maximized}
          minimized={window.minimized}
          active={window === front}
        >
          {window.content}
        </Window>
      ))}

      {askingRestart && (
        <RestartAlert
          onCancel={() => setAskingRestart(false)}
          onRestart={() => {
            setAskingRestart(false);
            setRestarting(true);
          }}
        />
      )}
      {asleep && <SleepScreen onWake={() => setAsleep(false)} />}
      {/* A restart is the screen going dark, then the page loading again */}
      {restarting && <SleepScreen onDark={() => window.location.reload()} />}
    </div>
  );
};

export default Desktop;