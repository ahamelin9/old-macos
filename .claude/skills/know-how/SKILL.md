---
name: know-how
description: Solved problems and how-tos for the macOS 1999 site, so nothing is troubleshot twice. Read it before troubleshooting anything here (maps, layout, the dev server, lint, the smaller apps; API problems point into the apis skill), and before proving a change in a real browser (headless Chrome, faking Near Me's location, checking every app still opens). Add an entry after solving anything that took troubleshooting.
---

# Know-how

This is the index of problems we've already solved. **Check here before
troubleshooting.** Find the symptom below, then read only the file it points
to. The entries live in topic files next to this one, so the index stays
short however much the list grows.

## Index

**Checking your work**: [checking.md](checking.md)

| Symptom or task | Entry |
|---|---|
| Prove a change works in a real browser | [Proving a change in a real browser](checking.md#proving-a-change-in-a-real-browser) |
| Check every app still opens after a shared change | [Does every app still open?](checking.md#does-every-app-still-open) |
| Check the windows, Camera, Notes, Safari, Pokémon or Music volume still work | [Do the windows and the smaller apps still behave?](checking.md#do-the-windows-and-the-smaller-apps-still-behave) |
| Check NASA News's sidebar: past days, scrolling, search, dates | [Does NASA News's sidebar still work?](checking.md#does-nasa-newss-sidebar-still-work) |
| Nothing works on the port the preview reported | [The dev server isn't on the port the preview says](checking.md#the-dev-server-isnt-on-the-port-the-preview-says) |
| `npm run lint` reports a problem | [`npm run lint` fails](checking.md#npm-run-lint-fails) |

**APIs and backends**: their own skill now, **`apis`**, one file per service
(setup, limits, known issues, a live probe). The symptoms we've solved:

| Symptom or task | Where |
|---|---|
| "Failed to fetch", "Could not load this specimen", or a page of Unknown badges | `apis` skill, `inaturalist.md` (rate limits) |
| A UI piece never appears because its field is always empty | `apis` skill, `inaturalist.md` (a field always empty) |
| A test script gets 403 or 429 | `apis` skill, `inaturalist.md` and `wikipedia.md` |
| Music logs "Guest fetch error" in dev, or the backend says `No module named 'fastapi'` | `apis` skill, `spotify.md` |
| NASA News shows an error, loads forever, or shows a NASA logo titled "NASA Science" | `apis` skill, `nasa.md` |
| Safari says "No results found" for a real search | `apis` skill, `brave-search.md` |

**Maps and layout**: [maps-and-layout.md](maps-and-layout.md)

| Symptom or task | Entry |
|---|---|
| `TypeError … '_leaflet_pos'` | [Leaflet throws `_leaflet_pos` after the map closes](maps-and-layout.md#leaflet-throws-_leaflet_pos-after-the-map-closes) |
| A map is part grey after a resize or after being hidden | [A map is half grey or the wrong size](maps-and-layout.md#a-map-is-half-grey-or-the-wrong-size-after-a-resize-or-being-hidden) |
| Buttons in a row jump by a pixel when one appears | [A row of buttons shifts by a pixel](maps-and-layout.md#a-row-of-buttons-shifts-by-a-pixel-when-one-appears) |
| One app's CSS restyles other apps, or a CSS change needs proving | [Every button changed when one app's CSS changed](maps-and-layout.md#every-button-on-the-site-changed-when-one-apps-css-changed) |
| Something sits past the edge of the 400px window | [A bar's right end is cut off](maps-and-layout.md#a-bars-right-end-is-cut-off-in-the-400px-window) |

**The smaller apps**: [apps.md](apps.md)

| Symptom or task | Entry |
|---|---|
| The webcam stays on after Camera closes, or a stream won't stop | [The webcam stays on](apps.md#the-webcam-stays-on-after-camera-closes) |
| Pokémon blames the wifi for a misspelled name | [Pokémon says "turn off wifi"](apps.md#pokémon-says-turn-off-wifi-for-a-misspelled-name) |
| Changing a Music setting disconnects the Premium player | [Music's volume and the player](apps.md#changing-musics-volume-would-disconnect-the-premium-player) |
| A guest preview won't start ("play() request was interrupted"), or the end of a clip skips several tracks | [Music's guest previews](apps.md#a-guest-preview-wont-start-or-the-end-of-a-clip-skips-several-tracks) |

**Answered elsewhere** (these have their one home in another file):

| Symptom | Where |
|---|---|
| A Field Guide tab, or All Species, is missing species | `field-guide` skill, sections 3 and 4 (`Animalia` means "other animals") |
| A spot-check gives the wrong status for a well-known species | `field-guide` skill, section 3 (autocomplete can return a "complex") and section 6 |
| The Wikipedia summary is about the wrong thing | `field-guide` skill, section 4 (the Wikipedia guard) |

## Scripts in this folder

| Script | What it does |
|---|---|
| `cdp.mjs` | Headless Chrome helper for browser checks (see `checking.md`) |
| `smoke-check.mjs` | Opens every dock app at desktop and phone width; fails on any page error |
| `window-check.mjs` | Drags, resizes, minimizes and maximizes windows; checks phone fit (`checking.md`) |
| `app-check.mjs` | Camera, Notes, Safari, Pokémon and Music volume (`checking.md`) |
| `nasa-check.mjs` | NASA News's sidebar against live NASA at three sizes (`checking.md`) |
| `style-diff.mjs` | Snapshots every button's computed style, to diff before and after a CSS change (`maps-and-layout.md`) |
| `app-shots.mjs` | Before-and-after screenshots of every app on a laptop and a phone, with a pixel diff (`design` skill, section 4) |

## Adding an entry

Add one when the fix took a wrong first theory, a check you had to build, or
a tool that misbehaved. Skip routine fixes.

1. **Before writing, check the fact has no home already.** Data facts about
   the Field Guide belong in the `field-guide` skill, and how the site is
   built belongs in `system-map`. If the home is elsewhere, add only an
   **Answered elsewhere** row here.
2. **Pick the topic file that fits.** Start a new one (say, `pokemon.md`) for
   a new area, or when a file passes about 10 entries or 300 lines.
3. **Write the entry under a heading named for the symptom** as Alex would
   describe it, not after the code. Use four short parts: **Symptom**,
   **Cause**, **Fix**, **Check**. Name the files and commands, and add the
   date.
4. **Add a row to the index above**, linking to the heading.
5. **Rewrite an entry that turns out wrong.** Don't add a second one beside
   it.
6. **Keep reusable scripts in this folder**, never in the scratchpad, which
   is deleted after the session. The 2026-11-09 browser tests were lost that
   way; only `cdp.mjs` was recovered.
7. **Write down how to get a number, not the number.** Counts (tests, lint
   errors, lines) go stale. Give the command, or a dated snapshot.
