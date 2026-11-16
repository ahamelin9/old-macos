---
name: design
description: The macOS 1999 site's shared styles. Covers the design tokens (colours, fonts, text sizes, corners, shadows, gradients in src/styles/tokens.css), the base and kit layers, the cascade layers that let an app's stylesheet override them, the rules the design check in npm run lint enforces, and step-by-step recipes for using a value, adding a token or kit class, styling a new app, moving an old app onto the tokens, and proving a style change with before-and-after screenshots on a laptop and a phone. Read it before any CSS or visual change, before adding an app, and when the design check fails.
---

# Design: the shared styles

The site should look like one late-90s Mac, not twelve apps that each picked
their own greys. Shared values live in one place, every app builds from them,
and an app's own stylesheet holds only what makes it different.

## Contents

1. [The layers](#1-the-layers)
   - [Settings reach the styles through tokens](#settings-reach-the-styles-through-tokens)
   - Dark mode: its own file, [`dark-mode.md`](dark-mode.md) (how it
     switches, which token to use, an app's own colours, proving it)
2. [The rules](#2-the-rules)
3. [Recipes](#3-recipes)
4. [Proving a style change](#4-proving-a-style-change)
5. [Decisions](#5-decisions)

---

## 1. The layers

| File | Layer | Holds |
|---|---|---|
| `src/styles/tokens.css` | `tokens` | Every value: the palette (`--grey-*`, `--blue-*`…), which never changes; the tones (`--tone-*`), faces (`--face-*`) and tints (`--tint-*`), which follow light and dark; roles (`--color-*`); fonts, text sizes, corners, gradients, shadows, the wallpapers and the Dock's sizes, then the **Settings** block (below). Its comments say what each is for. **The one home for values: never copy them here.** |
| `src/styles/base.css` | `base` | The page, the reset, and the default look of plain elements (the platinum `button`). The only file allowed to style a bare element. |
| `src/styles/kit.css` | `kit` | Shared `mac-…` classes for patterns more than one app uses (toolbar, field, primary button, message, list row, pull-down menu). |
| Each app's `<Name>.css`, and the shell's `styles.css` files | none | That app's layout and its deliberate differences, built from tokens. |

`main.tsx` imports the three shared files before `App`, and `tokens.css`
opens with `@layer tokens, base, kit;`. Styles in a layer always lose to
styles in no layer, so **an app's rule beats the shared ones whatever their
specificity**, and nothing needs `!important`.

To see every token, read `tokens.css`. To see where the site still uses raw
values: `node scripts/design-check.mjs --status`.

### Settings reach the styles through tokens

System Preferences puts each choice on `<html>` as a `data-*` attribute
(`system-map`, section 3), and the **Settings** block at the end of
`tokens.css` turns it into token values. An app never reads a setting; it
uses the tokens, and follows every setting for free.

- **Text size.** Every `--text-*` is its Medium size times `--text-scale`:
  `calc(12px * var(--text-scale))`. `data-text-size` sets the scale: Small
  0.9, Medium 1, Large 1.15, Larger 1.3. The text tokens are worked out on
  `:root`, so setting `--text-scale` on an element further down changes
  nothing. Display sizes kept in an app's own palette (Calculator's
  readout, Field Guide's big emoji, Pokémon's micro labels) don't scale, on
  purpose.
- **Graphite** (`data-highlight="graphite"`) swaps the `--blue-*` ramp for
  greys of the same lightness. Everything Aqua (title bars, Aqua buttons,
  selection, progress bars, tabs) is built from that ramp, in every app, so
  all of it turns at once. `--blue-link` stays blue, and the window buttons
  turn grey through their roles (`--color-close`, `--color-minimize`,
  `--color-zoom`, their `-edge`s and `-glyph`s). So: **build anything Aqua from
  `--blue-*` or a role, never an app's own blue**, or Graphite misses it.
  An identity blue (NASA's, Pokémon's) belongs in the app's palette exactly
  so that it doesn't turn.
- **Wallpapers** are `--wallpaper-<id>` tokens, each a whole `background`
  value, used by the desktop and by the Desktop pane's swatches. All are
  original CSS gradients; never copy Apple's pictures.
- **The Dock** reads `--dock-icon-size`, `--dock-item-width` and the
  `--dock-magnify*` trio. Under 800px, Large stays Medium so five apps fit.
- **Dark mode** (`data-theme`) changes the tones, faces, tints and some
  roles, never the palette: [`dark-mode.md`](dark-mode.md). So **an app's
  text, fills and borders come from a role, tone, face or tint**, or dark
  mode misses them.
- A new setting's look goes in the Settings block as
  `:root[data-<setting>="<value>"] { … }`, nowhere else.

## 2. The rules

`npm run lint` runs `scripts/design-check.mjs`, which enforces these. Its
header says exactly what each rule matches.

1. **Values come from tokens.** Colours, `font-family`, `font-size` and
   `border-radius` are `var(--…)`. Pick a role (`--color-text`) first, then
   a tone, face or tint (`--tone-20`). A fixed `--grey-*`, a pale `--blue-*`
   or a deep blue as text is only allowed in the app's palette, because it
   wouldn't turn in dark mode (`dark-mode.md`, section 2).
2. **An app may keep its own palette.** Colours that belong to one app and
   nowhere else (Pokémon's type colours, Field Guide's IUCN colours) go in
   custom properties named after the app, declared once at the top of its
   stylesheet: `.fieldguide-app { --fg-native: #5E9E4A; }`. So do display
   sizes off the text scale (Calculator's 36px readout, Field Guide's 48px
   emoji). That is the only place outside `tokens.css` a raw value may
   appear.
3. **Every selector starts with one of the app's classes.** The prefixes for
   each stylesheet are in `PREFIXES` in the check. An unprefixed class is
   fine after the app's root: `.pokemon-container .loading`. Keyframe names
   carry the prefix too. This is what stops one app restyling another
   (know-how, `maps-and-layout.md`, the Calculator leak).
4. **No `!important`.** If an app rule seems to need it, the conflict is with
   another app's rule, which rule 3 removes.
5. **No raw colours in `.ts`/`.tsx`.** Use a class, or `style={{ color:
   'var(--color-…)' }}`. Leaflet shapes take a `className` (MapPreview's
   zone circle), and HTML handed to Leaflet takes classes too. A colour that
   must reach another service as a value (iNaturalist's tile colours) lives
   in one palette file, each line marked as an exception (rule 6):
   `FieldGuide/palette.ts`.
6. **A real exception says why**, in a comment containing
   `design-exception:` on the same line. Use it rarely; a pattern of
   exceptions means a missing token.

Spacing (padding, margin, gap) and layout sizes stay as plain px: they are
per-layout, and tokens for them would only add noise.

Two things the check can't see:

- **A text field someone types in on a phone is 16px (`--text-xl`) or
  larger.** An iPhone zooms the whole page into any field smaller than
  that (Safari's search box).
- **A disabled button has to look disabled.** Plain buttons and
  `mac-button-primary` already do; an app that restyles a button styles its
  `:disabled` state too.

## 3. Recipes

### Use a colour, font, size or corner

1. Find the role in `tokens.css` by its job (its comment says the job). Use
   `var(--color-…)`.
2. No role fits? Use the tone, face or tint that matches (`--tone-N` is
   `--grey-N` in light), or `--blue-*` for Aqua (`dark-mode.md`, section 2).
3. Nothing is close? Add a token (next recipe), or, if only this app will
   ever use it, add it to the app's own palette (rule 2).

### Add a token

1. Check twice that nothing in `tokens.css` is close: a near-duplicate is
   what this setup exists to prevent.
2. Add it to the right group in `tokens.css`, with a comment saying its job
   if it is a role.
3. If it changes how things look, prove it (section 4).

### Add a kit class

1. Only for a pattern that two or more apps use. Name it `mac-…`.
2. Build it from tokens in `kit.css`, then use it in each app with
   `className="mac-… <app class>"`, and delete what each app duplicated.
3. Prove both apps (section 4).

### Style a new app

1. Give its root element a class with the app's prefix (`<name>-app`), and
   prefix every class (`system-map`, **Adding an app**).
2. Add its stylesheet and prefixes to `PREFIXES` in
   `scripts/design-check.mjs`. The check fails until you do.
3. Start from the kit: `mac-toolbar`, `mac-field`, `mac-button-primary`,
   `mac-message`, `mac-list-row`, `mac-menu` (a pull-down menu: its comment
   in `kit.css` says how to mark the rows), and plain `<button>`s, which are
   already platinum. Write only what's left.
4. `npm run lint`, then check it at 400×300, maximized and on a phone, in
   light and dark, and run the contrast scan (section 4).

### Move an older stylesheet onto the tokens

The way every app was moved in November 2026; use it for anything brought
in from elsewhere. Do one app at a time. Field Guide's 2,200 lines were
snapped with a throwaway script (nearest token by colour distance, then a
hand-reviewed list of the colours it couldn't place); a stylesheet that big
is worth the same.

1. Take "before" screenshots (section 4).
2. Run `node scripts/design-check.mjs <its stylesheet>` for the list.
3. Scope the selectors: prefix the app's root class onto any selector that
   doesn't start with an app class, and rename keyframes.
4. Swap raw values for tokens, snapping to the nearest one: a shade or a
   pixel of difference is the point (decision 2). Keep the app's identity
   colours in its own palette.
5. Swap duplicated patterns for kit classes; delete `!important`s.
6. Take "after" screenshots, compare, and look at every changed pair at
   laptop and phone sizes. Fix anything that looks worse.
7. `npm run lint`.

### The design check fails

It prints each problem with a one-line fix. If a fix seems wrong for the
case, it is probably a missing token (add one) or a real exception (mark it,
rule 6). Every file passed in November 2026, so there is no baseline: any
new problem fails the lint. (The check still supports one, `--update`, for a
future migration.)

## 4. Proving a style change

Two scripts in `know-how` do this, against a dev server
(know-how, `checking.md`, for starting one):

```bash
node .claude/skills/know-how/app-shots.mjs http://127.0.0.1:5199 <before-dir>
# …make the change…
node .claude/skills/know-how/app-shots.mjs http://127.0.0.1:5199 <after-dir>
node .claude/skills/know-how/app-shots.mjs --compare <before-dir> <after-dir> <diff-dir>
```

- `app-shots.mjs` saves every app at 400×300 and maximized on a laptop, the
  five phone apps small and maximized on a 390px phone, and both desktops.
  It seeds `Math.random` and answers NASA with a fixed picture, so two runs
  match pixel for pixel. Pass app names after the folder to shoot only those.
- `--compare` lists which shots changed and by how much, and saves a diff
  image of each (changed pixels in red) and `pair-<name>.png`, before and
  after side by side. Look at the pair of every changed shot, not just the
  numbers.
- Field Guide's status badges, and where its window lands on a phone, can
  change between runs as iNaturalist answers (it draws random numbers as
  results arrive); everything else should be identical unless you changed
  it.
- Once (2026-11-15) a run drew NASA News without its round ☰, though no
  NASA file had changed; two later runs matched each other. When an app you
  didn't touch changes, shoot it again before blaming your change.
- The shots don't open pop-ups such as Field Guide's Specimen Inspector.
  For one of those, check out the last commit with `git worktree add`,
  serve it on another port, and shoot both.
- `style-diff.mjs` compares the computed style of every button, for a change
  that should alter nothing. It pairs buttons by their order on the page,
  so an app that gains buttons makes every app after it look changed; read
  the first changed group, not the count.
- To shoot with a setting on, add `--settings '{"textSize":"larger"}'`
  (or `"highlight":"graphite"`, `"wallpaper":"ripple"`, `"theme":"dark"`).
  A change to the text tokens needs a run at Larger as well as Medium; a
  change to a colour token needs a light run compared with the one before
  and a look at a dark run. `--scheme dark` fakes a dark computer (for
  System); without it the shots fake a light one.
- `contrast-scan.mjs` lists every app's text that is too faint against
  what's behind it, in dark unless you pass `--theme light`
  (know-how, `checking.md`).

Send Alex the pairs that changed on purpose.

## 5. Decisions

1. **Plain CSS custom properties, not SCSS or CSS modules** (2026-11-15).
   No new build step; custom properties can change while the page runs
   (themes); and moving 4,600 lines into modules would have touched every
   component. Prefixes plus the check give the same safety.
2. **Snap to the nearest token** (Alex, 2026-11-15). Moving an app over may
   shift a colour by a shade or a corner by a pixel; that is the cohesion
   being asked for. Each app's before-and-after shots are checked by eye.
3. **Cascade layers for the shared styles**, so apps override them without
   `!important` or specificity tricks.
4. **Apps keep their identity.** Pokémon stays red, blue and yellow; NASA
   keeps NASA blue. Those live in each app's own palette, and everything
   else (greys, borders, fonts, corners, shadows) is shared. Field Guide's
   beige background was snapped to the shared chrome grey, as one site.
5. **Lucida Grande for text, not Geneva** (2026-11-15). macOS ships Geneva
   with no bold, so every `font-weight: bold` in an app set in Geneva showed
   as regular. With Lucida Grande first in `--font-body`, the headings and
   buttons that were always meant to be bold (Finder, Pokémon, Field Guide)
   now are.
6. **Aqua gel buttons, with a nod to glass** (Alex, 2026-11-15). NASA
   News's round ☰ is the classic Aqua gel: `--gradient-aqua` at 92% over a
   light `backdrop-filter` blur, `--gradient-gloss` on its top half, a thin
   `--blue-800` border and `--shadow-raised`. It is in `NasaNews.css`. About This
   Mac's logo is drawn the same way, but isn't a button; make the gel a
   kit class when a second button wants one.
7. **Text size is one multiplier** (2026-11-15). Every text token follows
   `--text-scale`, so a text-size setting needs no app changes, and the
   default (1) leaves every size exactly as it was.
8. **Graphite turns the whole blue ramp** (2026-11-15), not a list of
   roles. Field Guide and others build Aqua from the ramp directly, and a
   roles-only Graphite would have left them blue. The window buttons turn
   grey too, as in Mac OS X; links stay blue.
9. **Dark mode is written twice, guarded by a test** (2026-11-15). CSS can't
   say "Dark, or System on a dark computer" in one selector, so the dark
   values sit in two identical blocks, and `src/styles/tokens.test.ts`
   fails when they drift. `light-dark()` would have said it once, but
   browsers before 2024 drop the whole value, and the shared tokens must
   never fail; light needs no `light-dark()` at all, so it is untouched by
   construction. App palettes do use `light-dark()` (`dark-mode.md`).
10. **Tones, faces and bevels are separate** (2026-11-15). A tone turns
    lightness inside out, which is right for text and pages but would light
    a platinum button from below and make a raised edge look sunken, so
    gradients use faces and bevels use their own two roles.
11. **Menus are Mac OS X 10.0-10.2's** (2026-11-15). The kit's `mac-menu` is
    `--color-menu` (the page's colour at 92%, `rgba(44, 47, 52, 0.92)` in
    dark), square under the menu bar and rounded below, with thin
    `--color-border-light` separators and ▸ for a submenu. The highlighted
    row is `--gradient-highlight` (`--blue-600` to `--blue-700`), not
    `--gradient-aqua`: white text needs the deeper blue to read, and the
    ramp makes it grey with Graphite. No blur behind it: those Macs had
    none.
12. **Aqua gem window buttons** (2026-11-15). 14px, built from the
    `--color-close`/`-minimize`/`-zoom` roles: a darker rim, a glow from
    the bottom, `--gradient-gloss` on the top half. The ×, − and + show
    only while the pointer is over the group, each in its `-glyph` shade; a
    background window's are `--color-control-idle` grey (a lighter face in
    dark). How they work: `system-map`, `windows.md`.
