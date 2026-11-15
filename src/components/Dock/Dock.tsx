// React
import { useEffect, useLayoutEffect, useRef, useState } from 'react';
// Context
import { useWindows } from '../../contexts/useWindows';
// Apps
import { appInfo, type AppId } from '../Apps/apps';
import { dockApps, runningApps, windowTiles } from './dockItems';
// Styling
import './styles.css';

/** The least room the Dock leaves at each side of the screen */
const SIDE_ROOM = 8;

/** Shrink the Dock to fit the screen (Dock/styles.css reads --dock-fit) */
const fitToScreen = (dock: HTMLElement) => {
  // offsetWidth is its width before the scale, so measuring never feeds back
  const room = window.innerWidth - SIDE_ROOM * 2;
  const scale = dock.offsetWidth > room ? room / dock.offsetWidth : 1;
  dock.style.setProperty('--dock-fit', String(Math.round(scale * 1000) / 1000));
};

/**
 * The Dock, as in Mac OS X: the apps, a thin divider, then each minimized
 * window as a small window with its app's icon on it, and the Trash. What it
 * shows is worked out in dockItems.ts. A click on an app is showApp: its
 * window comes to the front (restored if minimized), or one opens. A triangle
 * under an app says it has a window open. When it is wider than the screen
 * it shrinks to fit, as the real one did.
 */
const Dock = () => {
  const { windows, showApp, restoreWindow } = useWindows();
  const [isMobile, setIsMobile] = useState(window.innerWidth < 800);
  const dockRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleResize = () => {
      setIsMobile(window.innerWidth < 800);
    };

    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  // Under 800px only the five apps marked onPhone show, and two or more
  // minimized windows fold into one tile
  const { apps, trash } = dockApps(isMobile);
  const running = runningApps(windows);
  const tiles = windowTiles(windows, { fold: isMobile });

  // Shrink to fit the screen: at once when tiles come or go (before a window
  // aims its Scale effect at one), and whenever its size or the screen's
  // changes (a Dock size or text size in System Preferences, say)
  const tileKey = tiles.map(t => `${t.key}:${t.count}`).join(' ');
  useLayoutEffect(() => {
    if (dockRef.current) fitToScreen(dockRef.current);
  }, [tileKey, isMobile]);
  useEffect(() => {
    const dock = dockRef.current;
    if (!dock) return;
    const fit = () => fitToScreen(dock);
    const observer = new ResizeObserver(fit);
    observer.observe(dock);
    window.addEventListener('resize', fit);
    return () => {
      observer.disconnect();
      window.removeEventListener('resize', fit);
    };
  }, []);

  const appItem = (app: { id: AppId; name: string; icon: string }) => (
    <div key={app.id} className="dock-item" onClick={() => showApp(app.id)}>
      <img src={app.icon} alt={app.name} className="dock-icon" />
      <span className="dock-label">{app.name}</span>
      {running.has(app.id) && <span className="dock-running" aria-hidden="true" />}
    </div>
  );

  return (
    <div className="dock" ref={dockRef}>
      {apps.map(appItem)}

      {(tiles.length > 0 || trash) && <div className="dock-divider" aria-hidden="true" />}

      {tiles.map(tile => (
        <div
          key={tile.key}
          className="dock-item minimized-window"
          data-window-ids={tile.windowIds.join(' ')}
          title={tile.count > 1 ? `${tile.title} and ${tile.count - 1} more` : tile.title}
          onClick={() => restoreWindow(tile.restoreId)}
        >
          <div className="dock-icon dock-thumb">
            <div className="dock-thumb-window">
              {tile.appId && <img src={appInfo(tile.appId).icon} alt="" className="dock-thumb-icon" />}
            </div>
            {tile.count > 1 && <span className="dock-thumb-count">{tile.count}</span>}
          </div>
          <span className="dock-label">{tile.title}</span>
        </div>
      ))}

      {trash && appItem(trash)}
    </div>
  );
};

export default Dock;
