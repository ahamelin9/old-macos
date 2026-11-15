# Dark mode

Part of the `design` skill. The index is in `SKILL.md`.

"Graphite at night": Mac OS X never had a dark mode, so this is the Aqua
look after dark. Dark platinum chrome, a smoked-glass Dock, dark pages with
light text, and the Aqua blue still glossy on buttons, selections and title
bars (grey with Graphite). The wallpapers, photos, NASA pictures, Pokémon
sprites and type colours, the IUCN colours and the map tiles look the same
in both themes.

## Contents

1. [How it switches](#1-how-it-switches)
2. [Which token to use](#2-which-token-to-use)
3. [An app's own colours](#3-an-apps-own-colours)
4. [The rule for a new app](#4-the-rule-for-a-new-app)
5. [Proving it](#5-proving-it)

## 1. How it switches

System Preferences' Appearance pane offers System (the default), Light and
Dark, saved as `theme` (`system-map`, section 3). The look is two blocks at
the end of `tokens.css`'s Settings block:

- `:root[data-theme="dark"]`: Dark, whatever the computer says.
- `@media (prefers-color-scheme: dark) { :root:not([data-theme="light"]) }`:
  System on a dark computer. It is `:not([data-theme="light"])`, not
  `[data-theme="system"]`, because a first visit has nothing saved, so the
  early script sets no `data-theme` before React loads; the media query
  alone makes that first paint dark. It also follows the computer live:
  the browser re-matches the media query when the setting changes.

CSS can't say "Dark, or System on a dark computer" in one selector, so the
two blocks are the same declarations written twice. **Change both
together.** `src/styles/tokens.test.ts` fails when they differ, and when a
tone, face or tint has no dark value.

Both blocks set `color-scheme: dark`, so the browser's own parts turn dark
too: scrollbars, unstyled fields, the date picker. Light leaves
`color-scheme` alone, so light looks exactly as it did.

Dark changes tones, faces, tints, some roles, the shadows, the title bar
gradient and the Dock's glass. It never changes the palette (`--grey-*`,
`--blue-*`…): that is what lets something stay the same in both themes.

## 2. Which token to use

| For | Use | In dark |
|---|---|---|
| Text, page surfaces, wells, borders with a job | a role: `--color-text`, `-strong`, `-muted`, `--color-surface`, `-surface-alt`, `--color-chrome`, `--color-border`, `-border-light` | follows its tone |
| Any other grey for text, a fill or a border | a tone, `--tone-N` (N is the `--grey-N` it is in light) | the grey the same distance from the page the other way: text stays readable, a well stays a well |
| A grey in a raised control's gradient (platinum buttons, tabs, bars) | a face, `--face-N` | still lighter at the top, and lighter than the chrome. A tone would turn the gradient upside down and light the button from below |
| The lit and shaded edges of a bevel (a white top-left line, a sunken field's dark top-left) | `--color-bevel-light`, `--color-bevel-shadow` | a faint white line, a near-black one. A tone would swap them, and a raised thing would look sunken |
| A pale blue fill (a hovered row, a chip, the current card, striped rows) | a tint, `--tint-50` to `--tint-300` | a dark blue mixed into the page |
| Blue text on the page | `--color-accent-text` (headings, names), `--tint-600`, `--tint-800` | a light blue |
| Aqua: title bars, Aqua buttons, selection, progress, a menu's highlighted row | `--blue-*`, `--gradient-aqua`, `--gradient-titlebar`, `--color-selection`, `--gradient-highlight` | Aqua stays; title bars and selection go a step deeper |
| A pull-down menu (the kit's `mac-menu`) | `--color-menu` | the dark `--tone-90`, still a little see-through |
| White text on Aqua or a dark fill | `--color-text-on-accent` | white |
| Behind a photo, video or map | `--color-photo-mat` | black, as in light |

Tints and the Aqua roles are built from the `--blue-*` ramp, so Graphite
turns them grey in dark too.

## 3. An app's own colours

An app's palette (design rule 2) holds what is the app's own. In dark:

- **Most of it stays put**, on purpose: type colours, IUCN colours, the
  calculator's and Music's LCDs, the Pokédex chart's tinted chips. Text on
  one of those must stay put too, so it gets a palette entry of its own
  from the fixed palette: `--fg-iucn-ink: var(--grey-13)`, not
  `var(--color-text-strong)`, which turns light in dark.
- **What sits on something that stays light** stays light with it: Field
  Guide's map popup and credit line (`--fg-map-*`), Music's LCD ink.
- **A colour that needs a dark twin** is written
  `light-dark(<light>, <dark>)` in the palette:
  `--music-sidebar: light-dark(#e2e8f0, #262b33)`. It follows the theme
  because dark sets `color-scheme: dark`. Used for Field Guide's warm
  season highlight and notes, Pokémon's Pokédex paper, blue text, arrows
  and Gigantamax red, NASA's blue as text (`--nasa-blue-ink`; the logo
  blue itself stays for fills), and Music's sidebar.
- **A fill that only looked fixed** often has a role that turns with its
  text: an error box is `--color-error-bg`, not `--red-50`, and a tooltip
  is `--color-tooltip`, not `--yellow-50`. Using the raw colour leaves
  light text on a pale box in dark. (Browsers older than 2024 don't know `light-dark()`
  and show that one colour as the inherited one; the shared tokens don't
  use it for that reason.)

Notes has no yellow paper: its page is the window's, white in light and
dark in dark. Terminal follows the site too; its own `theme dark` command
still makes one terminal dark in either theme.

## 4. The rule for a new app

1. Text, fills and borders come from roles first, then tones, faces and
   tints (the table above). The design check flags any `--grey-*`, any pale
   `--blue-*` and any deep blue text outside an app's palette.
2. A colour that must look the same in both themes goes in the app's
   palette under a name saying what it is for.
3. Check it in dark at 400×300, maximized and on a phone, and run the
   contrast scan (below).

## 5. Proving it

- `know-how/dark-mode-check.mjs`: System follows the computer both ways
  live, Light and Dark override it, the first paint of a first visit on a
  dark computer, reloads, an older save, Graphite, Restore Defaults, and the
  pane's tiles at every size (know-how, `feature-checks.md`).
- `know-how/contrast-scan.mjs`: every app's text against what is behind
  it, in dark by default (`--theme light` for light).
- `app-shots.mjs … --settings '{"theme":"dark"}'` shoots every app in
  dark; `--scheme dark` fakes a dark computer for System. Without
  `--scheme`, the shots fake a light computer, so a run never depends on
  the Mac's own setting. A change to a shared token needs a light run
  compared with the one before (it must not change) and a look at the dark
  one.
