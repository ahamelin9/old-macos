---
name: know-how
description: Solved problems and how-tos for the macOS 1999 site, so nothing is troubleshot twice. Read it before troubleshooting anything here (API errors, maps, layout, the dev server, lint, Spotify), and before proving a change in a real browser (headless Chrome, faking Near Me's location, checking every app still opens). Add an entry after solving anything that took troubleshooting.
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
| Nothing works on the port the preview reported | [The dev server isn't on the port the preview says](checking.md#the-dev-server-isnt-on-the-port-the-preview-says) |
| `npm run lint` fails on files you didn't touch | [Lint fails before you changed anything](checking.md#lint-fails-before-you-changed-anything) |

**APIs and backends**: [apis.md](apis.md)

| Symptom or task | Entry |
|---|---|
| "Failed to fetch", "Could not load this specimen", or a page of Unknown badges | [iNaturalist is rate-limiting](apis.md#failed-to-fetch-could-not-load-this-specimen-or-a-page-of-unknown-badges) |
| A UI piece never appears because its field is always empty | [A field the code reads is always empty](apis.md#a-field-the-code-reads-is-always-empty) |
| A test script gets 403 or 429 | [A script gets 403 or 429 from iNaturalist or Wikipedia](apis.md#a-script-gets-403-or-429-from-inaturalist-or-wikipedia) |
| Music logs "Guest fetch error" in dev | [Music logs "Guest fetch error" locally](apis.md#music-logs-guest-fetch-error-locally) |

**Maps and layout**: [maps-and-layout.md](maps-and-layout.md)

| Symptom or task | Entry |
|---|---|
| `TypeError … '_leaflet_pos'` | [Leaflet throws `_leaflet_pos` after the map closes](maps-and-layout.md#leaflet-throws-_leaflet_pos-after-the-map-closes) |
| A map is part grey after a resize or after being hidden | [A map is half grey or the wrong size](maps-and-layout.md#a-map-is-half-grey-or-the-wrong-size-after-a-resize-or-being-hidden) |
| Buttons in a row jump by a pixel when one appears | [A row of buttons shifts by a pixel](maps-and-layout.md#a-row-of-buttons-shifts-by-a-pixel-when-one-appears) |

**Answered elsewhere** (these have their one home in another file):

| Symptom | Where |
|---|---|
| A Field Guide tab, or All Species, is missing species | `field-guide` skill, sections 3 and 4 (`Animalia` means "other animals") |
| A spot-check gives the wrong status for a well-known species | `field-guide` skill, section 3 (autocomplete can return a "complex") and section 6 |
| The Wikipedia summary is about the wrong thing | `field-guide` skill, section 4 (the Wikipedia guard) |
| `git status` shows `tsconfig.tsbuildinfo` after a type check | `CLAUDE.md`, **Running and checking** |

## Scripts in this folder

| Script | What it does |
|---|---|
| `cdp.mjs` | Headless Chrome helper for browser checks (see `checking.md`) |
| `smoke-check.mjs` | Opens every dock app at desktop and phone width; fails on any page error |

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
