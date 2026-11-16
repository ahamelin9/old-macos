---
name: apis
description: Every outside API the macOS 1999 site calls (NASA APOD, PokeAPI, iNaturalist, Wikipedia and Wikidata, OpenStreetMap's Nominatim, Photon and map tiles, Brave Search through Alex's Cloudflare worker, Spotify, Apple's iTunes Search), with one file per service covering what the site uses, setup and keys, limits and usage rules, known issues and how to probe it live. Also the rules every API call follows, the env vars, and the latest API audit with its WSJF ranking. Read it before touching any fetch, adding a service, or troubleshooting an app that loads data.
---

# APIs: every outside service the site calls

All of these are free, and only Spotify needs a key (a secret one). Each service has its own file; read only the one you need.

## Contents

1. [The services](#1-the-services)
2. [Rules every API call follows](#2-rules-every-api-call-follows)
3. [Keys and env vars](#3-keys-and-env-vars)
4. [Probing a service live](#4-probing-a-service-live)
5. [The audit](#5-the-audit)

## 1. The services

| Service | Used by | Key? | Its rules in one line | File |
|---|---|---|---|---|
| NASA APOD (science.nasa.gov) | NASA News | No | APOD moved; `api.nasa.gov`'s APOD answers junk now | [nasa.md](nasa.md) |
| PokeAPI | Pokémon | No | Cache what you can; 37 species are filed under a form name | [pokeapi.md](pokeapi.md) |
| iNaturalist | Field Guide | No | About 60 requests a minute; bursts get 429 | [inaturalist.md](inaturalist.md) |
| Wikipedia, Wikidata | Field Guide | No | About 1 request a second from scripts, with a User-Agent | [wikipedia.md](wikipedia.md) |
| Nominatim, Photon, OSM tiles | Field Guide | No | Nominatim: 1 a second, never type-ahead. Tiles: show the credit | [openstreetmap.md](openstreetmap.md) |
| Brave Search | Safari | In Alex's worker | 1 search a second, 2,000 a month | [brave-search.md](brave-search.md) |
| Spotify | Music, the menu bar | Yes, **secret** | No 30-second previews any more; dev mode allows listed users only | [spotify.md](spotify.md) |
| iTunes Search | Music (guest previews) | No | About 20 requests a minute: look up on play, never a whole playlist | [itunes.md](itunes.md) |

Where the code is: each file names it. The Spotify login's two backends are
in `system-map`, section 6. What iNaturalist's fields mean is in the
`field-guide` skill, section 3.

## 2. Rules every API call follows

1. **Check `res.ok` before reading the body.** A 404, a 429 and a 500 all
   come back as a response, not an error.
2. **Give a call a timeout when a hang would leave a spinner forever**
   (`AbortController`, about 10 s). The old NASA API hung for 13 s and more.
3. **Retry what's worth retrying.** iNaturalist calls go through
   `fetchWithRetry` (`FieldGuide/establishmentStatus.ts`): a 429 or 5xx
   waits 1 s, then 3 s.
4. **Say what went wrong, in the app's words.** "No results" must mean no
   results, not "rate-limited" (Safari did this).
5. **Drop stale answers.** When a newer request replaces an older one
   (type-ahead, a new search), ignore the older reply when it arrives.
6. **Be gentle.** These are free services run for everyone. No bursts in
   loops, no type-ahead against a service that forbids it, cache what
   doesn't change.
7. **Nothing personal goes out.** Never put Alex's email in a request,
   header or `User-Agent`. Scripts send `macos-1999-<purpose>/1.0`.
8. **A `VITE_*` value is public.** It is baked into the JavaScript anyone
   can read. A secret goes in a Pages Function (`functions/api/`) and its
   twin route in `backend/main.py`.

## 3. Keys and env vars

| Variable | Set in | Used by | Secret? |
|---|---|---|---|
| `SPOTIFY_CLIENT_ID`, `SPOTIFY_CLIENT_SECRET` | `backend/.env` (local; template in `backend/.env.example`) and the Cloudflare Pages env vars for Functions (also read as `VITE_SPOTIFY_…`) | `backend/main.py`, `functions/api/*.js` | **Yes.** Server side only. |
| Brave's key | Alex's Cloudflare worker, not this repo | `brave-search-worker` | Yes |

Never print the values in `.env` or `backend/.env`. To see which variables
exist: `sed 's/=.*/=<redacted>/' .env`. To use one in a probe, read it into
a shell variable and `unset` it afterwards (each file shows how).

## 4. Probing a service live

Each file has a **Probe** section with a command that checks the service is
up and answering the way the code expects. Probe before blaming the code,
and once more after a fix. Keep probes small: a few requests, a second or
more apart.

`npm run probe` runs them all in one go (`probe.mjs` in this folder), one
summary line plus any failure; `npm run probe -- nasa` runs one. Brave runs
only when named, as each probe spends a search. These are the only live
calls in day-to-day checking: browser checks use canned replies
(know-how's `checking.md`, `npm run check`).

## 5. The audit

*2026-11-15. Every service probed live and every call read.*

Ranked by **WSJF** (weighted shortest job first): cost of delay divided by
size. Cost of delay is the sum of three 1-to-10 scores: what visitors lose
(V), how much waiting hurts (T), and the risk it removes (R). Size is 1 (an
hour) to 5 (a day).

| # | Finding | V | T | R | Size | WSJF | Status |
|---|---|---|---|---|---|---|---|
| 1 | OSM map tiles show no credit, which their usage policy requires | 2 | 3 | 8 | 1 | 13 | Fixed 2026-11-15 |
| 2 | Safari says "No results found" when Brave rate-limits a second search | 5 | 3 | 2 | 1 | 10 | Fixed 2026-11-15 |
| 3 | Eight Field Guide iNaturalist calls skip `fetchWithRetry`, so a 429 loses data | 3 | 2 | 5 | 1 | 10 | Fixed 2026-11-15 |
| 4 | NASA News fails all day when NASA can't serve today's picture | 8 | 5 | 2 | 2 | 7.5 | Fixed 2026-11-15: the real cause was APOD moving to science.nasa.gov (nasa.md) |
| 5 | Field Guide's place type-ahead calls Nominatim, which forbids type-ahead; stale replies can win | 2 | 3 | 8 | 2 | 6.5 | Fixed 2026-11-15 |
| 6 | Pokémon can't find 37 species by name (Deoxys, Mimikyu…), and their evolution sprites go missing | 5 | 2 | 3 | 2 | 5 | Fixed 2026-11-15 |
| 7 | Music loads only the first 100 tracks of a playlist | 3 | 1 | 1 | 1 | 5 | Fixed 2026-11-15 |
| 8 | Pokémon downloads the full name list (93 KB) every time it opens | 1 | 1 | 2 | 1 | 4 | Fixed 2026-11-15 |
| 9 | The Brave worker answers any website (`Access-Control-Allow-Origin: *`), so others could spend the 2,000 a month | 1 | 1 | 5 | 2 | 3.5 | Open, Alex's worker |
| 10 | `VITE_ENABLE_CORS_PROXY` is declared but nothing reads it | 1 | 1 | 1 | 1 | 3 | Fixed 2026-11-15 |
| 11 | Music's guest mode plays nothing: Spotify returns no previews (0 of 327 tracks) | 8 | 3 | 3 | 5 | 2.8 | Fixed 2026-11-15 |
| 12 | Music's Premium player may lose its token after an hour (`system-map`, section 9) | 3 | 1 | 2 | 3 | 2 | Open, needs a Premium login to test |

Item 11 scores low only because it's the biggest job; it's the one that
matters most to visitors once the quick ones are done.
