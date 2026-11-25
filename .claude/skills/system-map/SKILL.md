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
   - Finder: its own file, [`finder.md`](finder.md) (the pretend disk,
     keeping the projects' notes true, opening things, the layouts)
2. [The window manager](#2-the-window-manager): its own file,
   [`windows.md`](windows.md) (`useWindows`, a window and its buttons,
   minimize and the Scale effect, the Dock)
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
  The desktop draws every window, minimized ones too (hidden), and marks the
  front one; the Dock comes first. Its
  background is the chosen wallpaper ([section 3](#3-settings-system-preferences));
  the default is `public/mac-os-background.jpg`.
- **The Apple menu** (`AppleMenu.tsx`, the 🍎): About This Mac, System
  Preferences…, Dock ▸, Force Quit…, Sleep and Restart…. How it works, row
  by row: its own file, [`apple-menu.md`](apple-menu.md).
- **Window** (`Window.tsx`): drag, resize, the Aqua close, minimize and zoom
  buttons, double-click to minimize, maximize. [`windows.md`](windows.md),
  section 2.
- **Kit** (`src/components/Kit/`): small components every app can use,
  styled by the kit's classes. `LoadingImage` so far (the `design` skill,
  **Show a skeleton while something loads**).
- **Dock** (`Dock.tsx`, `dockItems.ts`): the apps, a divider, minimized
  windows as small windows, and the Trash; a triangle under each app with a
  window open; a click is `showApp`. Five apps under 800px, and it shrinks
  to fit the screen. [`windows.md`](windows.md), section 4.

## 2. The window manager

`useWindows()` (`src/contexts/useWindows.ts`): `showApp`, `openApp`,
`closeWindow`, `minimizeWindow`, `restoreWindow`, maximize and the frame.
A minimized window stays mounted, hidden, so its app keeps its state; an app
that should stop while hidden (Camera) reads `useOwnWindow()`. Every call,
minimize, the Scale effect and the Dock: [`windows.md`](windows.md).

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
| Finder | `Finder` | About Alex, as a small pretend disk (`finderFiles.ts`): the home folder (About Me, Skills and Interests as documents, LinkedIn and GitHub as links) and Projects, one item per app on the site with a note on what it is and how it's built; the smaller apps are in Projects ▸ Utilities. A click shows an item in the info pane; a double-click or Return opens it: a folder here, a document in its own window (one each, found by title), a project as the real app (`showApp`), a link in a new tab. Back, Forward, the path, icons or list (remembered). [`finder.md`](finder.md) | none | ✓ |
| Safari | `Safari` | Web search with results listed. Snippets show as text with the matched words bold, never as outside HTML; only http(s) results are links | Brave Search through Alex's own Cloudflare Worker, `brave-search-worker.ahamelin9.workers.dev` (its code is not in this repo) | |
| Nasa News | `NasaNews` | NASA's Astronomy Picture of the Day. The round ☰ at the right of the heading opens a sidebar of past days on the right (20 at a time as it scrolls), with a search box and a date box; a picked day shows in the same layout. Wide windows put the list beside the picture, narrow ones slide it over | science.nasa.gov's WordPress API (no key; `apis` skill, nasa.md) | ✓ |
| Pokemon | `PokemonSearch` | Pokédex: fuzzy search (`fuzzysort`), stats in US units, a clickable evolution chain with each stage's Megas and Gigantamax hanging off it, an "Other forms" row (regional forms, caps; `forms.ts`), shiny toggle, type chart | PokeAPI only (the two mirror APIs it used to try were dead); sprites from the PokeAPI GitHub | ✓ |
| Field Guide | `FieldGuide` | What lives near a place, and where a species lives. The biggest app by far | iNaturalist, Nominatim (OpenStreetMap), Wikipedia, Wikidata. **See the `field-guide` skill.** | ✓ |
| Planes | `Planes` | The planes in the sky over a place, live on a map that opens over your own location (the crosshair button goes back there): each drawn in the shape of its kind, with a filter by kind; click one for its photo, airline, usual route, aircraft, altitude and speed, and a trail of where it has been since. Search a place or use Near Me; **Find a Plane** looks up a flight, tail number or aircraft type anywhere in the world, says what it is over, and opens on Spotter's Picks, cards of remarkable aircraft; a card opens that aircraft's page (its story, picture and facts) over a world map of where each one is right now. Asks again every 10 s, and not while minimized. On a phone: bigger tap targets, the filter in a row, the chosen plane as a sheet at the bottom | adsb.lol through the site's `/api/planes`, adsbdb, planespotters.net, Wikipedia, Wikidata, Photon, Nominatim, OSM tiles (`apis` skill, adsb.md) | ✓ |
| Music | `Music` | Spotify player with Alex's playlists (`PLAYLISTS`). Playback needs Spotify Premium. A volume slider shows when the window is wider than 620px | Spotify Web API and Web Playback SDK, through `SpotifyContext` | |
| Camera | `Camera` | Webcam preview and snapshot; Save downloads a JPEG. The webcam is off while the window is minimized and once it closes | `getUserMedia` | |
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

`/api/planes` is the one `/api` route outside this table: a proxy with no
secret, which Vite passes straight to adsb.lol in dev, so it has no twin in
`backend/main.py` (`apis` skill, adsb.md).

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
   fails the build until there is one). Don't name a helper file the same
   as the component but for capitals (`planes.ts` beside `Planes.tsx`):
   know-how, `apps.md`.
4. If it works at phone width, set `onPhone: true` (five fit).
5. Make it work at 400×300, maximized, and at phone width. Size the layout
   from the window, not the browser:
   - container queries, like `.fieldguide-app`;
   - or a `ResizeObserver`, like `FieldGuide/useGridColumns.ts`.
6. If it needs a secret key, add a Function in `functions/api/` and the
   matching route in `backend/main.py` (CLAUDE.md, **Guardrails**).
7. Add a row to the table in [section 4](#4-the-apps). If it has more than
   a few files' worth of logic, give it its own skill, like `field-guide`.
8. Give it a project in Finder's `finderFiles.ts`, with a true note on what
   it is and how it's built (`finder.md`); a small app goes in Utilities.
   `finderFiles.test.ts` fails until there is one.

## 9. Known rough edges

These are facts to know while working, not tasks. Raise one with Alex only
when it gets in the way.

- All CSS is global; the `design` skill says how the shared styles and the
  design check keep apps from restyling each other.
- Trash is a placeholder.
- Safari is no longer in the phone Dock (Planes took its place,
  2026-11-16), and nothing else opens it on a phone.
- Skeleton loaders are in Planes only so far; Alex wants them in every app
  (the `design` skill, **Show a skeleton while something loads**).
- Some text is under WCAG's contrast bar in both themes: white on
  Pokémon's paler type colours (rock, grass, bug, fire…), and in light,
  white window titles on the title bar's pale top. Dark text on the paler
  types, as ice and ground already have, would fix Pokémon's (an idea,
  2026-11-15). The current list: know-how, `checking.md`, **Is any text
  too faint to read?**
- Each time a window comes to the front it gets a z-index above all the
  others, with no ceiling, and the menu bar, its Apple menu and the Dock sit at
  1000 (a minimized window sits at 999 while it shrinks). A visit with
  about a thousand window clicks would put a window over them. Renumbering the windows from 2 when the top passes, say, 900
  would keep them under.
- At Larger text, Dock labels are cut short ("Nasa N…"), and Pokémon's
  18-column type chart loses Dark, Steel and Fairy in the 400px window
  (it already loses Steel and Fairy at Medium). A container query giving
  it 9 columns in a narrow window, like its phone rule, would fix both
  sizes.
- `npm run build` warns that the main JavaScript chunk is over 500 kB (590 kB,
  183 kB gzipped, on 2026-11-16, after Planes). It's a warning, not an error; splitting
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
