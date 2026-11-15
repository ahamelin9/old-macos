---
name: system-map
description: How the macOS 1999 site is put together. Covers the desktop shell (menu bar, windows, dock), the window manager (useWindows), every app in the dock and which outside service each one calls, the Spotify login (local FastAPI and Cloudflare Pages Functions), and deploy (the live address). Read it before changing the desktop, windows or dock, before adding a new app, before touching Spotify, NASA or Safari wiring, and when asked "how does X work?" or "where is X?".
---

# How the site is put together

Keep this file true: when a change moves something here, update the matching
section in the same piece of work.

## Contents

1. [The shell](#1-the-shell)
   - The Apple menu: its own file, [`apple-menu.md`](apple-menu.md) (each
     row, the keyboard, where the submenu goes, Sleep and Restart)
2. [The window manager](#2-the-window-manager)
3. [Settings: System Preferences](#3-settings-system-preferences)
4. [The apps](#4-the-apps)
5. [Outside services, keys and env vars](#5-outside-services-keys-and-env-vars)
6. [Spotify login: two backends that must match](#6-spotify-login-two-backends-that-must-match)
7. [Deploy](#7-deploy)
8. [Adding an app](#8-adding-an-app)
9. [Known rough edges](#9-known-rough-edges)

---

## 1. The shell

```
index.html (early settings script)  →  src/main.tsx  →  App.tsx
                                  SettingsProvider       (src/contexts/SettingsContext.tsx; hook in useSettings.ts)
                                    SpotifyProvider      (src/contexts/SpotifyContext.tsx; hook in useSpotify.ts)
                                      WindowProvider     (src/contexts/WindowContext.tsx; hook in useWindows.ts)
                                        Desktop          (src/components/Desktop/)
                                          menu bar + clock
                                            AppleMenu    (the 🍎; AppleMenu.tsx, keys in menuKeys.ts)
                                          Window × n     (src/components/Window/)
                                          Dock           (src/components/Dock/)
                                          RestartAlert, SleepScreen (over everything, when chosen)
```

- **Desktop** (`Desktop.tsx`): the menu bar and the windows. The 🍎 opens
  the Apple menu (below); the other titles (Finder, File…) are
  for show, apart from **Disconnect Spotify**, which appears once you are
  logged in. The clock uses `date-fns`, in the format the settings choose.
  The desktop draws every window that is open and not minimized. Its
  background is the chosen wallpaper ([section 3](#3-settings-system-preferences));
  the default is `public/mac-os-background.jpg`.
- **The Apple menu** (`AppleMenu.tsx`, the 🍎): About This Mac, System
  Preferences…, Dock ▸, Force Quit…, Sleep and Restart…. How it works, row
  by row: its own file, [`apple-menu.md`](apple-menu.md).
- **Window** (`Window.tsx`):
  - Drag it by the title bar (pointer capture). Resize it from the
    bottom-right handle (minimum 300×200).
  - The buttons are close, minimize and maximize/restore.
  - Maximize fills the space between the 26px menu bar and the dock, which
    it measures from `.dock`. It re-measures when the browser resizes.
  - A press anywhere inside a window brings it to the front.
  - Content sits in `.window-content`, which is the element that scrolls.
    Music and NASA News fill it edge to edge and scroll their own panes
    instead (`.window-content:has(…)` in `Window/styles.css`).
- **Dock** (`Dock.tsx`): the apps in `Apps/apps.ts` marked `inDock`, with
  their names and icons ([section 4](#4-the-apps)). A click is
  `openApp(id)`, a new window each time.
  - Under 800px wide (`isMobile`), only the five marked `onPhone` show:
    Finder, Safari, Nasa News, Pokemon and Field Guide.
  - Its icon size and magnification come from the settings, through
    `--dock-*` tokens.
  - Minimized windows appear after the apps as 📄 items.

## 2. The window manager

`useWindows()` (`src/contexts/useWindows.ts`, with the types and
`MENU_BAR_HEIGHT`) returns `windows` and these. The provider in
`WindowContext.tsx` holds the state; hooks and types sit in their own file so
the provider file exports only a component (react-refresh).

| Call | Does |
|---|---|
| `openApp(appId, request?)` | Opens a new window of an app from `src/components/Apps/apps.ts`, whatever is open already. The Dock uses it |
| `showApp(appId, request?)` | Brings the app's window to the front, restoring it if minimized, or opens one if it has none. With a `request` (Preferences' `pane`), an open window gets it as new props and keeps its state. Which window, when there are several: `planShowApp` in `showApp.ts` (tested). The Apple menu uses it |
| `openWindow(title, content)` | Adds a window with any content and no app. Every window opens in front: 400×300 at a random spot near the top left, shrunk and clamped to fit a phone. Ids come from a counter |
| `closeWindow(id)` | Removes it from the list |
| `focusWindow(id)` | Brings it to the front (no change, and no re-render, if it's already there) |
| `setWindowFrame(id, position, size)` | Saves where it is. Window calls it when a drag or resize ends |
| `minimizeWindow(id)` / `restoreWindow(id)` | Hide it to the dock / bring it back in front, where it was |
| `maximizeWindow(id, position, size)` / `unmaximizeWindow(id)` | Fill the desktop, remembering the old frame / go back to it |

- The context is the one home for each window's frame. During a drag,
  Window keeps the moving frame in local state and saves it on pointer-up.
- Each window carries its app's `appId`; `showApp` finds windows by it,
  never by title.
- The Dock still opens a new window on every click (`openApp`). Making it
  `showApp`, so an open app's icon brings its window back, is the next step.
- `content` is a React element made when the window opens (`launchApp` in
  `Apps/launch.tsx`). Closing the window unmounts it, so an app's state is
  lost on close unless the app saves it.
- `know-how/window-check.mjs` proves all of this in a real browser.

## 3. Settings: System Preferences

Everything System Preferences can change, for the whole site, saved in this
browser and nowhere else (no cookies, no network).

| File | Holds |
|---|---|
| `src/contexts/settings.ts` | `CHOICES` (every setting is one choice from a list; the first is the default), `WALLPAPERS`, reading, validating, saving, `applySettings`, `clockPattern`. Pure, with tests |
| `src/contexts/SettingsContext.tsx` + `useSettings.ts` | The live copy: `settings`, `change(patch)`, `restoreDefaults()`, and the visitor's picture (`pictureUrl`, `setPicture`, `removePicture`) |
| `src/contexts/storage.ts` | `readStored` / `writeStored` / `removeStored`: localStorage that never throws. Spotify's tokens use them too |
| `src/contexts/desktopPicture.ts` | Checking an upload, shrinking it, and keeping it in IndexedDB |
| `index.html`, the inline `<script>` | The early script (below) |
| `src/styles/tokens.css`, its **Settings** block | What each choice looks like (the `design` skill, **Settings reach the styles through tokens**; dark mode in its `dark-mode.md`) |
| `src/components/Apps/Preferences/` | The app: `Preferences.tsx` (Show All grid, toolbar, the Restore Defaults sheet), `panes.tsx` (the four panes, and the Appearance pane's light, dark and System tiles) |

How a setting flows:

1. **Saved** as one JSON object in localStorage under `macos-1999-settings-v1`,
   only once something changes. Reading takes each known key with an allowed
   value and gives the default for anything else, one key at a time, so bad
   JSON, unknown keys, wrong types and storage that throws all end in the
   defaults, never an error.
2. **On `<html>`** as a `data-*` attribute per setting (`textSize` →
   `data-text-size="larger"`). `tokens.css` turns each into values, so no
   app reads a setting itself. The clock and the wallpaper are drawn by
   `Desktop.tsx` from `useSettings()` instead.
3. **Before the first paint.** The early script in `index.html` reads the
   saved JSON and sets the same attributes before React loads, so a returning
   visitor never sees the default look first. It sets any plain key and
   value it finds, so a new setting needs no change there.
   `settings.test.ts` runs it and checks it agrees with `applySettings`.
4. **At once, everywhere:** `change()` saves, and a layout effect re-sets
   the attributes before the browser paints, so open windows follow.

The visitor's picture is shrunk with a canvas (longer side 2560px, JPEG at
0.85) and kept as one record in IndexedDB (`macos-1999` → `desktop` →
`picture`); localStorage is too small for it. It shows through an object
URL. When IndexedDB is off (some private windows) it still shows for the
visit, and the Desktop pane says so. Choosing `custom` with no picture shows
the photo.

**Dark mode** is the `theme` setting: `system` (the default), `light` or
`dark`, chosen with three picture tiles at the top of the Appearance pane.
System follows the computer's light or dark setting, live. It needs no
JavaScript: `tokens.css` has a block for `data-theme="dark"` and the same
block under `@media (prefers-color-scheme: dark)` for anything but
`data-theme="light"`, so a first visit (nothing saved, no `data-theme` yet)
on a dark computer is dark on the first paint, and an older save without
`theme` gets System. How it looks, and which tokens follow it: the `design`
skill, `dark-mode.md`. `know-how/dark-mode-check.mjs` proves it.

**Adding a setting:**

1. Add a line to `CHOICES`, default first (`theme` came in this way). An
   older save without it gets the default; no new key is needed.
2. Give it values in `tokens.css`'s Settings block:
   `:root[data-<setting>="<value>"] { … }`.
3. Add the choice to a pane in `panes.tsx` (`<Choice>`), and a row to
   `know-how/preferences-check.mjs`.

A change older code can't read gets a new key (`…-v2`) and an entry in
`OLDER_FORMATS` saying how to upgrade the old value; the tests show the path.

`know-how/preferences-check.mjs` proves all of this in a real browser.

## 4. The apps

All of them live in `src/components/Apps/<Folder>/`, as `<Name>.tsx` and
`<Name>.css`. `Apps/apps.ts` lists them all, in Dock order: each one's id,
Dock name, window title, icon and whether it shows in the Dock on a laptop
and on a phone. `Apps/launch.tsx` says what each draws.

| Dock name | Folder | What it is | Calls out to | Phone |
|---|---|---|---|---|
| Finder | `Finder` | About Alex: About Me, Projects, Skills and Interests, with LinkedIn and GitHub links | none | ✓ |
| Safari | `Safari` | Web search with results listed. Snippets show as text with the matched words bold, never as outside HTML; only http(s) results are links | Brave Search through Alex's own Cloudflare Worker, `brave-search-worker.ahamelin9.workers.dev` (its code is not in this repo) | ✓ |
| Nasa News | `NasaNews` | NASA's Astronomy Picture of the Day. The round ☰ in the heading opens a sidebar of past days (20 at a time as it scrolls), with a search box and a date box; a picked day shows in the same layout. Wide windows put the list beside the picture, narrow ones slide it over | science.nasa.gov's WordPress API (no key; `apis` skill, nasa.md) | ✓ |
| Pokemon | `PokemonSearch` | Pokédex: fuzzy search (`fuzzysort`), stats in US units, a clickable evolution chain with each stage's Megas and Gigantamax hanging off it, an "Other forms" row (regional forms, caps; `forms.ts`), shiny toggle, type chart | PokeAPI only (the two mirror APIs it used to try were dead); sprites from the PokeAPI GitHub | ✓ |
| Field Guide | `FieldGuide` | What lives near a place, and where a species lives. The biggest app by far | iNaturalist, Nominatim (OpenStreetMap), Wikipedia, Wikidata. **See the `field-guide` skill.** | ✓ |
| Music | `Music` | Spotify player with Alex's playlists (`PLAYLISTS`). Playback needs Spotify Premium. A volume slider shows when the window is wider than 620px | Spotify Web API and Web Playback SDK, through `SpotifyContext` | |
| Notes | `Notes` | A textarea, kept in `localStorage` (`notes_text`) | none | |
| Camera | `Camera` | Webcam preview and snapshot; Save downloads a JPEG. The webcam turns off when the window closes | `getUserMedia` | |
| Calculator | `Calculator` | Calculator | none | |
| Terminal | `Terminal` | Fake shell: `help clear echo date ls cd cat pwd whoami theme history`. It follows the site's light or dark; `theme dark/light` darkens or lightens this one terminal (`--term-bg`/`--term-text`) | none | |
| System Preferences | `Preferences` | Desktop (seven CSS wallpapers, the photo, or your own picture), Appearance (System, Light or Dark; text size; Blue or Graphite), Dock (size, magnification), Date & Time (12/24-hour, seconds), and Restore Defaults. Its `pane` prop opens it at a pane. [Section 3](#3-settings-system-preferences) | none; IndexedDB and localStorage only | from the Apple menu (the phone Dock leaves it out) |
| Trash | `Trash` | Placeholder text | none | |
| (Apple menu) About This Mac | `AboutThisMac` | The logo (the 🍎 on an Aqua gel), "macOS 1999", a version line, and this browser's cores, memory and display. [`apple-menu.md`](apple-menu.md) | none | ✓ |
| (Apple menu) Force Quit | `ForceQuit` | Every other open window, minimized ones too, with its app's icon; Force Quit closes the picked one | none | ✓ |

`public/Music/i-love-you-forever.mp3` is a local track in the repo.

## 5. Outside services, keys and env vars

Every outside API (what each app calls, keys and env vars, limits, known
issues, how to probe it) is in the **`apis` skill**, one file per service.
The apps table above says which app uses which.

## 6. Spotify login: two backends that must match

The same four routes exist twice. Change one, and change the other to match.

| Route | Local: `backend/main.py` (FastAPI, port 8000) | Production: `functions/api/*.js` (Cloudflare Pages Functions) |
|---|---|---|
| `/api/login` | `GET /login`. Vite proxies `/api/*` to `127.0.0.1:8000` and strips `/api` (`vite.config.ts`) | `login.js` |
| `/api/callback` | `GET /callback`. Redirect URI `http://127.0.0.1:8000/callback` | `callback.js`. Redirect URI `<origin>/api/callback` |
| `/api/refresh` | `POST /refresh` with JSON `{ "refresh_token": … }` | `refresh.js` (`onRequestPost`, POST only) |
| `/api/client_credentials` | `GET /client_credentials` | `client_credentials.js` |

The flow:

1. Music calls `login()`, which goes to `/api/login`.
2. Spotify asks you to agree, then sends you to the callback.
3. The backend swaps the code for tokens and sends you back to the site
   with `#access_token=…&refresh_token=…`. The fragment never reaches a
   server log or a `Referer`. Errors come back as `?error=…`.
4. `SpotifyContext` reads the tokens (the fragment first, then the query, for
   an older deploy), saves them in `localStorage` (`spotify_access_token`,
   `spotify_refresh_token`), clears the URL and checks `/v1/me` for Premium.
5. An access token lasts an hour. A 401 from `/v1/me` refreshes it once
   through `POST /api/refresh` (keeping a rotated refresh token if Spotify
   sends one). If that fails, or a fresh token is refused within a minute,
   it logs out and says the login expired.

Both redirect URIs have to be listed in the Spotify developer dashboard.
Spotify doesn't accept `localhost` redirect URIs, which is why dev runs on
`127.0.0.1`.

## 7. Deploy

- Cloudflare Pages project `old-macos` (`wrangler.toml`), serving `./dist`.
  The `functions/` folder deploys with it as Pages Functions.
- The live site is **`https://old-macos-2vr.pages.dev`** (Cloudflare added
  the `-2vr`; `old-macos.pages.dev` does not serve this site). Each deploy also gets
  its own preview address, listed on the commit's Cloudflare Pages check.
- Pages appears to deploy on every push to `main`. The commit `c7960c8`
  ("retrigger Cloudflare Pages deploy") was an empty push made just to start
  a deploy.
- The build is `tsc -b && vite build`, so a type error fails the deploy.
  Run `npx tsc -b` before saying something is ready.
- `.wrangler/` is local Wrangler state.

## 8. Adding an app

1. Make `src/components/Apps/<Name>/<Name>.tsx` and `<Name>.css`. Style it
   from the shared tokens and kit, with an app-prefixed root class (the
   `design` skill, **Style a new app**).
2. Add an icon at `public/<name>-icon.png`, in the same style as the others.
3. Add a line to `APPS` in `src/components/Apps/apps.ts`: a stable `id`,
   the Dock `name`, the window `title`, the `icon`, and `inDock`. The order
   is the order in the dock. Then a `case` in `Apps/launch.tsx` (TypeScript
   fails the build until there is one).
4. If it works at phone width, set `onPhone: true` (five fit).
5. Make it work at 400×300, maximized, and at phone width. Size the layout
   from the window, not the browser:
   - container queries, like `.fieldguide-app`;
   - or a `ResizeObserver`, like `FieldGuide/useGridColumns.ts`.
6. If it needs a secret key, add a Function in `functions/api/` and the
   matching route in `backend/main.py` (CLAUDE.md, **Guardrails**).
7. Add a row to the table in [section 4](#4-the-apps). If it has more than
   a few files' worth of logic, give it its own skill, like `field-guide`.

## 9. Known rough edges

These are facts to know while working, not tasks. Raise one with Alex only
when it gets in the way.

- All CSS is global; the `design` skill says how the shared styles and the
  design check keep apps from restyling each other.
- Trash is a placeholder.
- Some text is under WCAG's contrast bar in both themes: white on
  Pokémon's paler type colours (rock, grass, bug, fire…), and in light,
  white window titles on the title bar's pale top. Dark text on the paler
  types, as ice and ground already have, would fix Pokémon's (an idea,
  2026-11-15). The current list: know-how, `checking.md`, **Is any text
  too faint to read?**
- Each time a window comes to the front it gets a z-index above all the
  others, with no ceiling, and the menu bar, its Apple menu and the Dock sit at
  1000. A visit with about a thousand window clicks would put a window
  over them. Renumbering the windows from 2 when the top passes, say, 900
  would keep them under.
- At 390px the Dock is 402px wide and runs 6px past each edge; it always
  has. Large stays Medium there, so it's no worse. Trimming its side
  padding and gaps under 800px would make it fit, but changes the default
  look on a phone.
- At Larger text, Dock labels are cut short ("Nasa N…"), and Pokémon's
  18-column type chart loses Dark, Steel and Fairy in the 400px window
  (it already loses Steel and Fairy at Medium). A container query giving
  it 9 columns in a narrow window, like its phone rule, would fix both
  sizes.
- `npm run build` warns that the main JavaScript chunk is over 500 kB (549 kB,
  168 kB gzipped, on 2026-11-15, after the Apple menu). It's a warning, not an error; splitting
  the apps into lazy-loaded chunks would clear it.
- The local Spotify backend listens on `0.0.0.0:8000` (`backend/main.py`), so
  other devices on the same network can reach it while it runs. `127.0.0.1`
  would be enough, since Vite's proxy is on the same Mac.
- NASA News in the 400×300 window fits only three past days below the
  search and date boxes. A small calendar button in place of the date box
  would leave room for more (an idea, 2026-11-15).
- Music's Premium player gets its token once, when it's built: the SDK's
  `getOAuthToken` hands back the token from that moment. After about an hour
  of playing, the SDK may report an auth error. Fixing it needs a Premium
  login to test.
- `npm run backend` needs FastAPI installed: `pip install -r
  backend/requirements.txt`.
