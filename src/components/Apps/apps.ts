// Every app the desktop can open: a stable id, its name in the Dock, its
// window title and its icon. The window manager opens them by id (openApp
// and showApp in useWindows); what each one draws is in launch.tsx. This
// file holds no components, so anything can read it (Force Quit reads the
// icons) without importing every app.

export interface AppInfo {
  /** Stable: the window manager, the Apple menu and the checks key on it, never on the title */
  id: string;
  /** Its label in the Dock */
  name: string;
  /** Its window's title bar */
  title: string;
  /** An image in public/ */
  icon: string;
  /** Shown in the Dock on a laptop */
  inDock: boolean;
  /** Also shown in the phone's Dock (under 800px there is room for five) */
  onPhone: boolean;
}

/** In Dock order. About This Mac and Force Quit open from the Apple menu only. */
export const APPS = [
  { id: 'finder', name: 'Finder', title: 'Finder', icon: '/finder-icon.webp', inDock: true, onPhone: true },
  { id: 'safari', name: 'Safari', title: 'Safari', icon: '/safari-icon.png', inDock: true, onPhone: true },
  { id: 'nasa', name: 'Nasa News', title: 'Nasa News', icon: '/nasa-icon.png', inDock: true, onPhone: true },
  { id: 'pokemon', name: 'Pokemon', title: 'Pokemon Search', icon: '/pokemon-icon.png', inDock: true, onPhone: true },
  { id: 'fieldguide', name: 'Field Guide', title: 'Field Guide (Flora & Fauna)', icon: '/fieldguide-icon.png', inDock: true, onPhone: true },
  { id: 'music', name: 'Music', title: 'Music', icon: '/music-icon.png', inDock: true, onPhone: false },
  { id: 'notes', name: 'Notes', title: 'Notes', icon: '/notes-icon.png', inDock: true, onPhone: false },
  { id: 'camera', name: 'Camera', title: 'Camera', icon: '/camera-icon.png', inDock: true, onPhone: false },
  { id: 'calculator', name: 'Calculator', title: 'Calculator', icon: '/calculator-icon.png', inDock: true, onPhone: false },
  { id: 'terminal', name: 'Terminal', title: 'Terminal', icon: '/terminal-icon.png', inDock: true, onPhone: false },
  { id: 'preferences', name: 'System Preferences', title: 'Preferences', icon: '/preferences-icon.png', inDock: true, onPhone: false },
  { id: 'trash', name: 'Trash', title: 'Trash', icon: '/trash-icon.png', inDock: true, onPhone: false },
  { id: 'about', name: 'About This Mac', title: 'About This Mac', icon: '/macintosh-favicon.png', inDock: false, onPhone: false },
  { id: 'forcequit', name: 'Force Quit', title: 'Force Quit Applications', icon: '/macintosh-favicon.png', inDock: false, onPhone: false }
] as const satisfies readonly AppInfo[];

export type AppId = (typeof APPS)[number]['id'];

/**
 * What a caller asks of an app as it opens or comes to the front. Only
 * System Preferences reads one today: `pane` opens it at that pane (the
 * Apple menu's Dock Preferences…).
 */
export interface AppRequest {
  pane?: string;
}

export const appInfo = (id: AppId): AppInfo => APPS.find(app => app.id === id)!;
