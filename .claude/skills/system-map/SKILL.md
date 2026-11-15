---
name: system-map
description: How the macOS 1999 site is put together. Covers the desktop shell (menu bar, windows, dock), the window manager (useWindows), every app in the dock and the outside services each one calls, the Spotify login (local FastAPI and Cloudflare Pages Functions), env vars and keys, and deploy. Read it before changing the desktop, windows or dock, before adding a new app, before touching Spotify, NASA or Safari wiring, and when asked "how does X work?" or "where is X?".
---

# How the site is put together

Keep this file true: when a change moves something here, update the matching
section in the same piece of work.

## Contents

1. [The shell](#1-the-shell)
2. [The window manager](#2-the-window-manager)
3. [The apps](#3-the-apps)
4. [Outside services, keys and env vars](#4-outside-services-keys-and-env-vars)
5. [Spotify login: two backends that must match](#5-spotify-login-two-backends-that-must-match)
6. [Deploy](#6-deploy)
7. [Adding an app](#7-adding-an-app)
8. [Known rough edges](#8-known-rough-edges)

---

## 1. The shell

```
index.html  →  src/main.tsx  →  App.tsx
                                  SpotifyProvider        (src/contexts/SpotifyContext.tsx; hook in useSpotify.ts)
                                    WindowProvider       (src/contexts/WindowContext.tsx; hook in useWindows.ts)
                                      Desktop            (src/components/Desktop/)
                                        menu bar + clock
                                        Window × n       (src/components/Window/)
                                        Dock             (src/components/Dock/)
```

- **Desktop** (`Desktop.tsx`): the menu bar and the windows. The menu items
  are for show, apart from **Disconnect Spotify**, which appears once you
  are logged in. The clock uses `date-fns`. The desktop draws every window
  that is open and not minimized. The background is
  `public/mac-os-background.jpg`.
- **Window** (`Window.tsx`):
  - Drag it by the title bar (pointer capture). Resize it from the
    bottom-right handle (minimum 300×200).
  - The buttons are close, minimize and maximize/restore.
  - Maximize fills the space between the 26px menu bar and the dock, which
    it measures from `.dock`. It re-measures when the browser resizes.
  - A press anywhere inside a window brings it to the front.
  - Content sits in `.window-content`, which is the element that scrolls.
- **Dock** (`Dock.tsx`): the `apps` array. Each entry has a name, an icon
  from `public/`, and `openWindow(title, <App />)`.
  - Under 800px wide (`isMobile`), only Finder, Safari, Field Guide, Nasa
    News and Pokemon show.
  - Minimized windows appear after the apps as 📄 items.

## 2. The window manager

`useWindows()` (`src/contexts/useWindows.ts`, with the types and
`MENU_BAR_HEIGHT`) returns `windows` and these. The provider in
`WindowContext.tsx` holds the state; hooks and types sit in their own file so
the provider file exports only a component (react-refresh).

| Call | Does |
|---|---|
| `openWindow(title, content)` | Adds a window in front: 400×300 at a random spot near the top left, shrunk and clamped to fit a phone. Ids come from a counter |
| `closeWindow(id)` | Removes it from the list |
| `focusWindow(id)` | Brings it to the front (no change, and no re-render, if it's already there) |
| `setWindowFrame(id, position, size)` | Saves where it is. Window calls it when a drag or resize ends |
| `minimizeWindow(id)` / `restoreWindow(id)` | Hide it to the dock / bring it back in front, where it was |
| `maximizeWindow(id, position, size)` / `unmaximizeWindow(id)` | Fill the desktop, remembering the old frame / go back to it |

- The context is the one home for each window's frame. During a drag,
  Window keeps the moving frame in local state and saves it on pointer-up.
- There is no single-instance check: clicking an app twice opens two windows.
- `content` is a React element made when the window opens. Closing the window
  unmounts it, so an app's state is lost on close unless the app saves it.
- `know-how/window-check.mjs` proves all of this in a real browser.

## 3. The apps

All of them live in `src/components/Apps/<Folder>/`, as `<Name>.tsx` and
`<Name>.css`.

| Dock name | Folder | What it is | Calls out to | Phone |
|---|---|---|---|---|
| Finder | `Finder` | About Alex: About Me, Projects, Skills and Interests, with LinkedIn and GitHub links | none | ✓ |
| Safari | `Safari` | Web search with results listed. Snippets show as text with the matched words bold, never as outside HTML; only http(s) results are links | Brave Search through Alex's own Cloudflare Worker, `brave-search-worker.ahamelin9.workers.dev` (its code is not in this repo) | ✓ |
| Nasa News | `NasaNews` | NASA's Astronomy Picture of the Day | `api.nasa.gov/planetary/apod` with `VITE_NASA_API_KEY` (falls back to `DEMO_KEY`) | ✓ |
| Pokemon | `PokemonSearch` | Pokédex: fuzzy search (`fuzzysort`), stats in US units, a clickable evolution chain, shiny toggle, type chart | PokeAPI only (the two mirror APIs it used to try were dead); sprites from the PokeAPI GitHub | ✓ |
| Field Guide | `FieldGuide` | What lives near a place, and where a species lives. The biggest app by far | iNaturalist, Nominatim (OpenStreetMap), Wikipedia, Wikidata. **See the `field-guide` skill.** | ✓ |
| Music | `Music` | Spotify player with Alex's playlists (`PLAYLISTS`). Playback needs Spotify Premium. A volume slider shows when the window is wider than 620px | Spotify Web API and Web Playback SDK, through `SpotifyContext` | |
| Notes | `Notes` | A textarea, kept in `localStorage` (`notes_text`) | none | |
| Camera | `Camera` | Webcam preview and snapshot; Save downloads a JPEG. The webcam turns off when the window closes | `getUserMedia` | |
| Calculator | `Calculator` | Calculator | none | |
| Terminal | `Terminal` | Fake shell: `help clear echo date ls cd cat pwd whoami theme history`; `theme dark/light` sets `--term-bg`/`--term-text` | none | |
| System Preferences | `Preferences` | Placeholder: three category labels | none | |
| Trash | `Trash` | Placeholder text | none | |

`public/Music/i-love-you-forever.mp3` is a local track in the repo.

## 4. Outside services, keys and env vars

| Variable | Set in | Used by | Secret? |
|---|---|---|---|
| `VITE_NASA_API_KEY` | `.env` (local) and the Cloudflare Pages build env | `NasaNews.tsx` | No. Every `VITE_*` value is baked into the public bundle. |
| `VITE_ENABLE_CORS_PROXY` | `.env` | Nothing reads it today | |
| `SPOTIFY_CLIENT_ID`, `SPOTIFY_CLIENT_SECRET` | `backend/.env` (local; template in `backend/.env.example`) and the Cloudflare Pages env vars for Functions (also read as `VITE_SPOTIFY_…`) | `backend/main.py`, `functions/api/*.js` | **Yes.** Server side only. |

No key is needed for iNaturalist, Nominatim, Wikipedia, Wikidata or PokeAPI.
All of them rate-limit bursts.

Never print the values in `.env` or `backend/.env`. To see which variables
exist, run `sed 's/=.*/=<redacted>/' .env`.

## 5. Spotify login: two backends that must match

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

## 6. Deploy

- Cloudflare Pages project `old-macos` (`wrangler.toml`), serving `./dist`.
  The `functions/` folder deploys with it as Pages Functions.
- Pages appears to deploy on every push to `main`. The commit `c7960c8`
  ("retrigger Cloudflare Pages deploy") was an empty push made just to start
  a deploy.
- The build is `tsc -b && vite build`, so a type error fails the deploy.
  Run `npx tsc -b` before saying something is ready.
- `.wrangler/` is local Wrangler state.

## 7. Adding an app

1. Make `src/components/Apps/<Name>/<Name>.tsx` and `<Name>.css`. Style it
   from the shared tokens and kit, with an app-prefixed root class (the
   `design` skill, **Style a new app**).
2. Add an icon at `public/<name>-icon.png`, in the same style as the others.
3. Add an entry to `apps` in `Dock.tsx`: `{ name, icon, action: () => openWindow('<Window title>', <Name />) }`.
   The order in the array is the order in the dock.
4. If it works at phone width, add its name to the mobile list in `Dock.tsx`.
5. Make it work at 400×300, maximized, and at phone width. Size the layout
   from the window, not the browser:
   - container queries, like `.fieldguide-app`;
   - or a `ResizeObserver`, like `FieldGuide/useGridColumns.ts`.
6. If it needs a secret key, add a Function in `functions/api/` and the
   matching route in `backend/main.py` (CLAUDE.md, **Guardrails**).
7. Add a row to the table in [section 3](#3-the-apps). If it has more than
   a few files' worth of logic, give it its own skill, like `field-guide`.

## 8. Known rough edges

These are facts to know while working, not tasks. Raise one with Alex only
when it gets in the way.

- All CSS is global; the `design` skill says how the shared styles and the
  design check keep apps from restyling each other.
- System Preferences and Trash are placeholders.
- Music's Premium player gets its token once, when it's built: the SDK's
  `getOAuthToken` hands back the token from that moment. After about an hour
  of playing, the SDK may report an auth error. Fixing it needs a Premium
  login to test.
- `npm run backend` needs FastAPI installed: `pip install -r
  backend/requirements.txt`.
