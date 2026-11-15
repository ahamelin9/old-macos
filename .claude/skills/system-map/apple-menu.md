# The Apple menu

Part of the `system-map` skill. The index is in `SKILL.md`.

## Contents

1. [How it works](#how-it-works)
2. [Files](#files)
3. [Decisions](#decisions)

## How it works

`src/components/Desktop/AppleMenu.tsx`, in the menu bar. The 🍎 is a real
button (`role="menuitem"` in a `role="menubar"`, with `aria-haspopup` and
`aria-expanded`); the menu is the kit's `mac-menu` (the `design` skill).

- Click the 🍎, or press Enter, Space or Down on it. Click it again, click
  outside or press Escape to close.
- Up and Down move, Home and End jump, Right and Left open and close the
  submenu, Enter and Space choose, Tab closes. All of it is `menuKeys.ts`,
  pure and tested. The focus follows the highlight, and goes back to the 🍎
  after a keyboard choice.
- The pointer highlights a row and opens Dock ▸ on hover; moving off Dock
  keeps the submenu a quarter of a second, so a diagonal path reaches it.
  A tap on Dock ▸ opens it (touch has no hover).
- The submenu opens to the right; on the left if the right has no room;
  inside the menu, under its row, if neither side has (a phone at Larger
  text). It is measured before the browser paints.

Each row:

| Row | Does |
|---|---|
| About This Mac | `showApp('about')`: the logo, name and version, and this browser's cores, memory and display (`AboutThisMac/specs.ts`; shown only, never saved or sent). More Info… is `showApp('finder')` |
| System Preferences… | `showApp('preferences')`. The phone's Dock has no Preferences, so this is how a phone reaches it |
| Dock ▸ | Turn Magnification On/Off (`change({ dockMagnify })`), and Dock Preferences…, `showApp('preferences', { pane: 'dock' })` |
| Force Quit… | `showApp('forcequit')`: every other window, minimized ones too, with its app's icon; Force Quit closes the picked one (`closeWindow`) |
| Sleep | `SleepScreen`: fades to black; any click, key or tap fades it back, and that click or key goes no further. Instant with reduced motion |
| Restart… | `RestartAlert` asks "Are you sure you want to restart your computer now?" (Cancel focused; Escape cancels); Restart fades to black, then `location.reload()` |

`know-how/apple-menu-check.mjs` proves all of this in a real browser
(know-how, `feature-checks.md`, **Does the Apple menu still work?**).

## Files

| File | Holds |
|---|---|
| `Desktop/AppleMenu.tsx` | The 🍎 button, the menu, the pointer and touch, where the submenu goes |
| `Desktop/menuKeys.ts` (+ test) | The keyboard, as a pure function |
| `Desktop/SleepScreen.tsx` | Sleep, and the fade before a restart |
| `Desktop/RestartAlert.tsx` | The "Are you sure…" alert |
| `Desktop/styles.css` | The 🍎 button, the alert, the black screen |
| `src/styles/kit.css`, `mac-menu` | How any menu looks (the `design` skill) |
| `Apps/AboutThisMac/` | About This Mac; `specs.ts` (+ test) words the specs |
| `Apps/ForceQuit/` | Force Quit Applications |

## Decisions

- **The 🍎 stays grey** (as the whole bar used to be, through a grayscale
  filter on it) and turns white on the highlight. The filter now covers only
  the 🍎 and Disconnect Spotify, so the menu's Aqua stays blue; in dark the
  bar is now exactly `--color-chrome`, a hair cooler than the greyed one.
- **Memory says "About"**: browsers round `navigator.deviceMemory` to a
  power of two (a 16 GB Mac read 16 in Chrome 156; older Chromes stopped at
  8), and Safari and Firefox don't share it ("Not shared by this browser").
- **Force Quit leaves itself off its list**, as the Mac did, and closes
  the picked window at once, with no "are you sure" (a sheet like Restart's
  would be easy to add).
