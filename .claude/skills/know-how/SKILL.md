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

**Checking your work**: [checking.md](checking.md), and one feature's own check in [feature-checks.md](feature-checks.md)

| Symptom or task | Entry |
|---|---|
| Prove a change works in a real browser | [Proving a change in a real browser](checking.md#proving-a-change-in-a-real-browser) |
| Check every app still opens after a shared change | [Does every app still open?](checking.md#does-every-app-still-open) |
| Check the windows, Camera, Notes, Safari, Pokémon or Music volume still work | [Do the windows and the smaller apps still behave?](checking.md#do-the-windows-and-the-smaller-apps-still-behave) |
| Check NASA News's sidebar: past days, scrolling, search, dates | [Does NASA News's sidebar still work?](feature-checks.md#does-nasa-newss-sidebar-still-work) |
| Check Pokémon's forms: Megas and Gigantamax in the line, Other forms, live spot-checks | [Do Pokémon's forms still work?](feature-checks.md#do-pokémons-forms-still-work) |
| Check System Preferences: every setting, reloads, uploads, Restore Defaults, storage blocked, sizes | [Does System Preferences still work?](feature-checks.md#does-system-preferences-still-work) |
| Check dark mode: System following the computer live, Light and Dark, the first paint, reloads, the Appearance tiles | [Does dark mode still work?](feature-checks.md#does-dark-mode-still-work) |
| Check the Apple menu: opening and closing, the keyboard, every row, Sleep, Restart, the phone | [Does the Apple menu still work?](feature-checks.md#does-the-apple-menu-still-work) |
| A highlight or colour looks missing in a screenshot | [Does the Apple menu still work?](feature-checks.md#does-the-apple-menu-still-work), lessons |
| Find text too faint to read, in dark or light; what's left over | [Is any text too faint to read?](checking.md#is-any-text-too-faint-to-read) |
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
| A row wider than its box is cut off on the left, and won't scroll there | [The left end of a centred row](maps-and-layout.md#the-left-end-of-a-centred-row-cant-be-scrolled-to) |
| An icon drawn with `::before`/`::after` is bigger than its box | [A CSS-drawn icon is bigger than its box](maps-and-layout.md#a-css-drawn-icon-is-bigger-than-its-box) |
| Pale text on a pale chip, error box or tooltip in dark | [Text on a pale chip is unreadable in dark mode](maps-and-layout.md#text-on-a-pale-chip-or-box-is-unreadable-in-dark-mode) |
| A disabled button's text isn't grey any more | [A disabled button's text stopped looking greyed](maps-and-layout.md#a-disabled-buttons-text-stopped-looking-greyed) |
| A screenshot diff shows thin lines along the desktop photo's edges | [The desktop photo changed by a hair](maps-and-layout.md#the-desktop-photo-changed-by-a-hair-when-nothing-should-have) |

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
| `nasa-check.mjs` | NASA News's sidebar against live NASA at three sizes (`feature-checks.md`) |
| `pokemon-forms-check.mjs` | Pokémon's Megas, Gigantamax and Other forms against live PokeAPI at three sizes, with spot-checks (`feature-checks.md`) |
| `style-diff.mjs` | Snapshots every button's computed style, to diff before and after a CSS change (`maps-and-layout.md`) |
| `app-shots.mjs` | Before-and-after screenshots of every app on a laptop and a phone, with a pixel diff; `--settings` shoots with a setting on, `--scheme dark` fakes a dark computer (`design` skill, section 4) |
| `preferences-check.mjs` | System Preferences: every setting, reloads, the early script, uploads, Restore Defaults, blocked storage, sizes (`feature-checks.md`) |
| `dark-mode-check.mjs` | Dark mode: System following the computer live, Light and Dark, the first paint, reloads, Graphite, Restore Defaults, the Appearance tiles (`feature-checks.md`) |
| `contrast-scan.mjs` | Every app's text against what's behind it, the Apple menu and the windows it opens too, in dark or light, with the failures listed (`checking.md`) |
| `apple-menu-check.mjs` | The Apple menu: mouse, keyboard and touch, every row, `showApp`, Sleep, Restart, the phone, and screenshots in each look (`feature-checks.md`) |

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
