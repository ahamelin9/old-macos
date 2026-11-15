# macOS 1999

Alex's personal site, made to look like a late-90s Mac desktop: a menu bar,
windows you can drag, resize, minimize and maximize, and a dock of small apps.

| App | What it does |
|---|---|
| Finder | About me, projects and skills |
| Safari | Web search (Brave Search, through a Cloudflare Worker) |
| Nasa News | NASA's Astronomy Picture of the Day |
| Pokemon | A Pokédex with evolution chains and a type chart (PokeAPI) |
| Field Guide | What lives near a place, and where a species lives (iNaturalist, Wikipedia) |
| Music | Spotify playlists: 30-second previews, or full songs with Spotify Premium |
| Notes | A note that's kept in your browser |
| Camera | Webcam snapshots you can download |
| Calculator, Terminal | Toys |

Built with React 19, TypeScript and Vite. Hosted on Cloudflare Pages, with
Pages Functions (`functions/api/`) for the Spotify login.

## Running it

```bash
npm install
npm run dev
```

The site is at http://127.0.0.1:5173 (Spotify won't redirect to `localhost`).

Music's Spotify login runs on a small FastAPI backend locally:

```bash
pip install -r backend/requirements.txt
npm run start:all
```

## Settings

Copy `backend/.env.example` to `backend/.env` for the Spotify keys. Variable
names only; values never go in the repo.

| Variable | Where | Secret? |
|---|---|---|
| `SPOTIFY_CLIENT_ID`, `SPOTIFY_CLIENT_SECRET` | `backend/.env` and the Pages Functions env | Yes |

## Checks

```bash
npm test
npm run lint
npm run build
```

`npm run build` type-checks first, so a type error stops the deploy.

## Deploying

Pushing to `main` deploys to the Cloudflare Pages project `old-macos`, which
serves `dist/` and the `functions/` folder.

## Working on it with Claude

`CLAUDE.md` is the starting point: how to run and check things, and a table
of contents for the skills in `.claude/skills/` (how the site fits together,
the Field Guide, solved problems, and the end-of-session wrap-up).
