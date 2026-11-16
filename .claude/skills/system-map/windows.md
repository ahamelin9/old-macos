# Windows, minimize and the Dock

Part of the `system-map` skill. The index is in `SKILL.md`.

## Contents

1. [The window manager](#1-the-window-manager)
2. [A window](#2-a-window)
3. [Minimize](#3-minimize)
4. [The Dock](#4-the-dock)
5. [Decisions](#5-decisions)

## 1. The window manager

`useWindows()` (`src/contexts/useWindows.ts`, with the types and
`MENU_BAR_HEIGHT`) returns `windows` and these. The provider in
`WindowContext.tsx` holds the state; hooks and types sit in their own file so
the provider file exports only a component (react-refresh).

| Call | Does |
|---|---|
| `showApp(appId, request?)` | Brings the app's window to the front, restoring it if minimized, or opens one if it has none. With a `request` (Preferences' `pane`), an open window gets it as new props and keeps its state. Which window, when there are several: `planShowApp` in `showApp.ts` (tested). The Dock's app icons and the Apple menu use it |
| `openApp(appId, request?)` | Opens a new window of an app from `src/components/Apps/apps.ts`, whatever is open already |
| `openWindow(title, content)` | Adds a window with any content and no app. Every window opens in front: 400×300 at a random spot near the top left, shrunk and clamped to fit a phone. Ids come from a counter |
| `closeWindow(id)` | Removes it from the list, which unmounts its app |
| `focusWindow(id)` | Brings it to the front (no change, and no re-render, if it's already there) |
| `setWindowFrame(id, position, size)` | Saves where it is. Window calls it when a drag or resize ends |
| `minimizeWindow(id)` / `restoreWindow(id)` | Hide it in the Dock, numbering it (`minimizedAt`) so the tiles keep their order / bring it back in front, where it was |
| `maximizeWindow(id, position, size)` / `unmaximizeWindow(id)` | Fill the desktop, remembering the old frame / go back to it |

- The context is the one home for each window's frame. During a drag,
  Window keeps the moving frame in local state and saves it on pointer-up.
- Each window carries its app's `appId`; `showApp` finds windows by it,
  never by title.
- `content` is a React element made when the window opens (`launchApp` in
  `Apps/launch.tsx`). It stays mounted until the window closes, minimized or
  not; closing loses an app's state unless the app saves it.
- An app can ask about its own window with `useOwnWindow()` (same file):
  today only `minimized`. Window provides it.

## 2. A window

`src/components/Window/Window.tsx` and `styles.css`.

- Drag it by the title bar, resize it from the bottom-right handle (minimum
  300×200). The pointer is captured by the title bar or the handle, not the
  whole window, so a double-click still lands on the title bar.
- **Double-click the title bar to minimize**, as in Mac OS X.
- Maximize fills the space between the 26px menu bar and the Dock, which it
  measures from `.dock`, and re-measures when the browser resizes.
- A press anywhere inside a window brings it to the front. The front window
  is the highest one showing; Desktop marks it `window-active`.
- Content sits in `.window-content`, which is the element that scrolls.
  Music, NASA News and System Preferences fill it edge to edge and scroll
  their own panes (`.window-content:has(…)`).
- **The buttons** are Aqua gems, 14px: a darker rim, a glow rising from the
  bottom and a white shine on the top half (`::before`). Their ×, − and +
  are drawn with gradients in `--window-glyph`, see-through until the pointer
  is over the group (or a key focuses one); then all three show, each in a
  darker shade of its own colour (`--color-*-glyph`). A window that isn't in
  front has grey buttons (`--color-control-idle`), in colour while hovered.
  Graphite greys all three. On a touch screen the front window always shows
  its glyphs. Each button's hit box (`::after`) covers half the gap each
  side and the title bar's height. On a touch screen the buttons keep the
  desktop spacing (Alex found the old wide spacing odd); only the hit boxes
  grow, taller and out past the outer two, so the middle one is about 21px
  wide. If that proves fiddly, make the buttons a little bigger rather than
  spreading them out.

## 3. Minimize

- **A minimized window stays mounted, hidden**, so its app keeps its state:
  Notes its text, Field Guide its search and its map (hidden by
  `visibility`, the map keeps its size, so Leaflet never sees it shrink),
  Music keeps playing. Desktop draws every window. A minimized one has
  `window-minimized` (invisible), `inert` and `aria-hidden`, and no inline
  z-index, so it never counts as the front window.
- **An app that should stop while hidden reads `useOwnWindow().minimized`.**
  Camera turns the webcam off, so the camera light isn't on for a hidden
  window, and back on when restored.
- **The Scale effect**: the window shrinks into its Dock tile in 250ms and
  grows back out on restore. Window aims it: it measures its tile's
  `.dock-icon` and sets `--window-to-dock` (`scale.ts`, tested), and aims
  again while minimized when other tiles come or go, or the screen resizes,
  so a restore grows from where the tile is now. `styles.css` runs it, above
  the other windows and under the Dock (z-index 999), and hides the window
  once it lands. Reduced motion makes it instant. The Dock comes before the
  windows in `Desktop.tsx`, so it has fitted itself before a window measures.
- Force Quit lists minimized windows too (`apple-menu.md`).

## 4. The Dock

`src/components/Dock/Dock.tsx` and `styles.css`; what it shows is worked
out in `dockItems.ts`, pure and tested.

```
[apps…] | [minimized windows…] [Trash]
```

- **The apps** (`dockApps`): those in `Apps/apps.ts` marked `inDock`; under
  800px (`isMobile`) only the five marked `onPhone`, and no Trash. A click
  is `showApp(id)`.
- **A triangle** under an app's icon while it has a window open, minimized
  or not (`runningApps`, `.dock-running`).
- **The divider**: always on a laptop, before the Trash; on a phone only
  when there are tiles.
- **Minimized windows** (`windowTiles`), in the order they were minimized,
  newest next to the Trash: each a small window with a title bar and its
  app's icon (`apps.ts`), labelled with the window's title. A click is
  `restoreWindow`. Under 800px two or more fold into one tile with a count,
  showing and restoring the newest first; each phone app's own icon brings
  its window back too.
- **It fits the screen.** Under 800px its gaps and ends are tighter, so the
  five phone apps fit a 390px screen. When it is wider than the screen less
  8px each side, `--dock-fit` scales it down (Dock.tsx, measured from
  `offsetWidth`, which the scale doesn't change, so it never feeds back).
  Three windows minimized on a phone: about 0.85, icons about 41px.
- Its icon size and magnification come from the settings, through
  `--dock-*` tokens.

## 5. Decisions

All 2026-11-15.

- **Double-click minimizes**, Mac OS X 10.0-10.2's default. Nothing used a
  double-click on the title bar before.
- **The zoom button always shows +**, as in Mac OS X; the ↔ it showed while
  maximized is gone. Its label still says "Restore window" then.
- **The phone folds minimized windows into one tile** that restores the
  newest first, rather than a pop-up list: a phone app's own icon, or the
  Apple menu, reaches any window directly.
- **The Dock shrinks to fit**, as the real one did, rather than dropping
  tiles. With the tighter phone gaps it is now inside a 390px screen even
  with nothing minimized (it used to be 402px).
- **Minimized windows go under the Dock** as they shrink, so they seem to go
  into it.

`know-how/minimize-check.mjs` proves all of this in a real browser, and
`know-how/window-check.mjs` the dragging, resizing and maximizing
(know-how, `feature-checks.md` and `checking.md`).
