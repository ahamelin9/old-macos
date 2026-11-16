# macOS 1999: notes for Claude

Alex's personal site, built to look like a late-90s Mac desktop. It has a menu
bar, windows you can drag and resize, and a dock of small apps: Field Guide,
Pokémon, NASA, Music (Spotify), Planes (live aircraft), Safari search, Finder
(about me) and a few toys. It's built with React 19, TypeScript and Vite, and deployed on Cloudflare
Pages (project `old-macos`). Cloudflare Pages Functions handle the Spotify
login and pass Planes' data through. The repo is `github.com/ahamelin9/old-macos`. Every session reads this
file first.

## Table of contents: where things live

| For | Read |
|---|---|
| How the site fits together: desktop, windows (minimize, the buttons), the Dock, every app, the Spotify login, deploy and the live address | the `system-map` skill |
| The Apple menu (🍎): About This Mac, Force Quit, Sleep, Restart, and `showApp`, which brings an app's window forward or opens one | the `system-map` skill, `apple-menu.md` |
| Any outside API (NASA, PokeAPI, iNaturalist, Wikipedia, OpenStreetMap, Brave, Spotify, iTunes, adsb.lol and adsbdb): setup, keys and env vars, limits, known issues, live probes, the API audit | the `apis` skill (an index, one file per service) |
| Planes: where the positions, routes and photos come from, the `/api/planes` proxy, when a route is shown, the map's shapes, Spotter's Picks | the `apis` skill, `adsb.md` |
| Adding a new app to the dock | the `system-map` skill, **Adding an app** |
| System Preferences and its settings: the store, the early script in `index.html`, the desktop picture, the theme, adding a setting | the `system-map` skill, **Settings** |
| Anything in the Field Guide: places, species, tabs, native/endemic/introduced, maps, Back, the inspector | the `field-guide` skill |
| Any CSS or visual change: the shared tokens, base and kit, skeleton loaders, the design check, before-and-after screenshots | the `design` skill |
| Dark mode: how it switches, which token to use, an app's own colours, the contrast scan | the `design` skill, `dark-mode.md` |
| Checking a change: `npm run check`, what it picks, canned API replies, timing | the `know-how` skill, `checking.md` |
| A problem that may have been solved before, or proving a change in a real browser | the `know-how` skill (an index pointing into topic files) |
| Where a learning, preference or decision goes; the end of a session | the `wrap-up` skill |

Each skill opens with its own contents list. To search all of them at once:
`grep -rn '^## ' .claude/skills/`.

## Running and checking

| What | Command | Notes |
|---|---|---|
| Dev server | `npm run dev` | Serves http://127.0.0.1:5173. It binds to `127.0.0.1`, not `localhost`, because Spotify redirects there. Alex often has it running already; check with `lsof -nP -iTCP:5173 -sTCP:LISTEN` first. |
| Spotify backend (local) | `npm run backend` or `npm run dev:all` | FastAPI on port 8000. Only Music needs it. It runs from its own Python environment, `backend/.venv`; set it up once with `npm run backend:setup` (the `apis` skill, `spotify.md`). |
| Unit tests | `npm test` | Vitest. Test files sit next to the code (`*.test.ts`). |
| Type check | `npx tsc -b` | Its cache, `tsconfig.tsbuildinfo`, is gitignored. |
| Lint | `npm run lint` | ESLint, then the design check (`scripts/design-check.mjs`, the `design` skill). Both pass; keep it that way. |
| **Check a change** | `npm run check` | Tests, types and lint, plus the browser checks for the files `git diff` shows, side by side, with canned API replies. One summary line; details only on failure. `--all` before a push. Options: the `know-how` skill, `checking.md`. |
| Live API probes | `npm run probe` | One small live call per outside service (the `apis` skill). Browser checks never call the live APIs unless asked. |
| Build | `npm run build` | Runs `tsc -b`, then `vite build` into `dist/`. A type error stops the deploy. |

## How a change goes

1. Read the skill for the area first (table above). Check `know-how` before
   troubleshooting anything.
2. **Give a real opinion.** Alex often pitches an idea as a question ("what
   do you think?", "how hard is that?"). Answer with a recommendation, a
   rough idea of the effort, and why, then build it on a yes. If you'd change
   part of the idea, say so. At the end, offer one good follow-up idea, not a
   list.
3. Build it, then prove it:
   - **`npm run check` is the check.** It runs only what the change touches.
     No screenshots unless Alex asks or something visual can't be checked
     any other way (`--shots`). If a subagent already ran it, don't rerun
     it all: just `npm run check -- nasa` (the quick checks plus the
     area you changed);
   - unit tests for logic;
   - a real-browser check for anything you can see (know-how);
   - for anything that shows facts, spot-checks against the live source
     (the `field-guide` skill, **Checking the data is right**). Alex wants
     what the site shows to be correct, not just plausible.
4. Report what changed, how you checked it, and what you could not check.
5. **Git: Alex commits.** "Get ready for a commit" means:
   - only the intended files are changed;
   - the checks pass;
   - you suggest a short message in the style of `git log`.

   Don't commit or push unless Alex asks, and then only for that work.
6. When a piece of work is done, or Alex says "wrap up", follow the `wrap-up`
   skill so nothing learned is lost.

## Guardrails every change keeps

- **No secrets in the repo or the bundle.** `.env` and `backend/.env` are
  gitignored: never commit them or print their values. Anything in a `VITE_*`
  variable ends up in the public JavaScript, so a real secret needs a
  Function in `functions/api/` (and a matching route in `backend/main.py`)
  instead.
- **Treat the repo as public.** Nothing personal beyond what the site already
  shows. Never put Alex's email address in requests to outside APIs, such as
  a `User-Agent` header.
- **Apps live in a window.** Every app has to work in the 400×300 window it
  opens in, maximized, and at phone width (under 800px the dock shows only
  five apps). Size layouts from the window (container queries,
  `ResizeObserver`), not from `window.innerWidth`.
- **Be gentle with free APIs.** iNaturalist, Nominatim, Wikipedia and PokeAPI
  need no key, but they rate-limit bursts.
- **Keep the retro look, built from the shared styles.** Values come from
  `src/styles/tokens.css`, and every selector in an app's stylesheet starts
  with that app's class, because every stylesheet is global. The design
  check in `npm run lint` enforces both (the `design` skill).
- **Every app works in light and dark.** Text, fills and borders use a
  role, tone, face or tint, so dark mode reaches them, and light must not
  change when dark does (the `design` skill, `dark-mode.md`).
