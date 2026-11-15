# Spotify

Part of the `apis` skill. Used by Music (`src/components/Apps/Music/Music.tsx`),
`SpotifyContext.tsx`, the menu bar's Disconnect item, and the login routes.
**How the login works, and the two backends that must match
(`backend/main.py` locally, `functions/api/*.js` live): `system-map`,
section 5.**

## What the site uses

| Call | For |
|---|---|
| `accounts.spotify.com/authorize`, `/api/token` | Login, token swap, refresh (server side only) |
| `/api/client_credentials` (ours) → `accounts…/api/token` | A guest token, so visitors who aren't logged in can see the playlists |
| `api.spotify.com/v1/playlists/{id}/tracks` (`spotify-web-api-js`) | A playlist's tracks; **100 per page**, `offset` for the next |
| `api.spotify.com/v1/me` | Is the login Premium? |
| `api.spotify.com/v1/me/player/play?device_id=…` | Play in the browser player |
| `sdk.scdn.co/spotify-player.js` | The Web Playback SDK: full songs, **Premium only** |

## Setup and limits

- Keys: `SPOTIFY_CLIENT_ID` and `SPOTIFY_CLIENT_SECRET`, secret, server side
  only (`apis` skill, section 3). Never in a `VITE_*` variable.
- **The app is in development mode.** Only Spotify accounts Alex adds in the
  developer dashboard (User Management) can log in. Anyone else gets an
  error from Spotify after agreeing.
- Both redirect URIs must be listed in the dashboard (`system-map`, section
  5). Spotify refuses `localhost`, so dev runs on `127.0.0.1`.
- The live site is `https://old-macos-2vr.pages.dev`; its
  `/api/client_credentials` is a quick check that the Functions and the
  secret work.

## Known issues

### Guest mode plays nothing: every track shows 🚫

*2026-11-15. Fixed 2026-11-15.*

- **Cause:** Spotify stopped returning `preview_url` (the 30-second clip) to
  apps in late 2024. On 2026-11-15, 0 of the 327 tracks in the five
  playlists had one.
- **Fix:** `Music/itunes.ts` finds a preview on Apple's iTunes Search when
  a guest presses play ([itunes.md](itunes.md)). It found the right one for
  16 of 20 tracks sampled across the five playlists on 2026-11-15; a track
  it can't find gets 🚫 after the first try.

### Long playlists stop at 100 tracks

*2026-11-15. Fixed 2026-11-15.* "Jackie & Alex <3" has 138 and "Tism"
126; Music showed the first 100 of each. It now asks for each next page of
100 (`offset`) until Spotify says there are no more, up to 1,000 tracks.

### Music logs "Guest fetch error" locally

*2026-11-15*

- **Symptom:** opening Music in dev logs `Guest fetch error: SyntaxError …
  Unexpected end of JSON input`.
- **Cause:** locally, Vite proxies `/api/client_credentials` to the FastAPI
  backend on port 8000, and nothing is running there.
- **Fix:** `npm run backend` (or `npm run start:all`), with `backend/.env`
  filled in from `backend/.env.example`.

### The Premium player's token after an hour

In `system-map`, section 8. Needs a Premium login to test.

## Probe

Gets a guest token from the live site without printing it, and counts
tracks with previews in one playlist:

```bash
T=$(curl -s https://old-macos-2vr.pages.dev/api/client_credentials | python3 -c "import json,sys;print(json.load(sys.stdin)['access_token'])")
curl -s -H "Authorization: Bearer $T" "https://api.spotify.com/v1/playlists/34LNnZ8iIV884x9xZZxDt6/tracks" | python3 -c "import json,sys;d=json.load(sys.stdin);i=[x['track'] for x in d['items'] if x.get('track')];print(len(i),'tracks,',sum(1 for t in i if t.get('preview_url')),'with previews')"
unset T
```
