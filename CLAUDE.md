# macOS 1999: notes for Claude

Alex's personal site, built to look like a late-90s Mac desktop. It has a menu
bar, windows you can drag and resize, and a dock of small apps: Field Guide,
Pokémon, NASA, Music (Spotify), Safari search, Finder (about me) and a few
toys. It's built with React 19, TypeScript and Vite, and deployed on Cloudflare
Pages (project `old-macos`). Cloudflare Pages Functions handle the Spotify
login. The repo is `github.com/ahamelin9/old-macos`. Every session reads this
file first.

## Table of contents: where things live

| For | Read |
|---|---|
| How the site fits together: desktop, windows, dock, every app, the outside services each one calls, env vars, deploy | the `system-map` skill |
| Adding a new app to the dock | the `system-map` skill, **Adding an app** |
| Anything in the Field Guide: places, species, tabs, native/endemic/introduced, maps, Back, the inspector | the `field-guide` skill |
| A problem that may have been solved before, or proving a change in a real browser | the `know-how` skill (an index pointing into topic files) |
| Where a learning, preference or decision goes; the end of a session | the `wrap-up` skill |

Each skill opens with its own contents list. To search all of them at once:
`grep -rn '^## ' .claude/skills/`.

## Running and checking

| What | Command | Notes |
|---|---|---|
| Dev server | `npm run dev` | Serves http://127.0.0.1:5173. It binds to `127.0.0.1`, not `localhost`, because Spotify redirects there. Alex often has it running already; check with `lsof -nP -iTCP:5173 -sTCP:LISTEN` first. |
| Spotify backend (local) | `npm run backend` or `npm run start:all` | FastAPI on port 8000. Only Music needs it. |
| Unit tests | `npm test` | Vitest. Test files sit next to the code (`*.test.ts`). |
| Type check | `npx tsc -b` | It rewrites `tsconfig.tsbuildinfo`, which git tracks, so run `git checkout -- tsconfig.tsbuildinfo` afterwards. |
| Lint | `npx eslint <files you touched>` | `npm run lint` on the whole repo already fails on older apps (know-how). |
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
- **Keep the retro look, and prefix CSS classes with the app**
  (`fieldguide-…`). Every stylesheet is global, so a generic class name can
  restyle another app.
