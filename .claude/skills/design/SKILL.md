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
2. [The rules](#2-the-rules)
3. [Recipes](#3-recipes)
4. [Proving a style change](#4-proving-a-style-change)
5. [Decisions](#5-decisions)

---

## 1. The layers

| File | Layer | Holds |
|---|---|---|
| `src/styles/tokens.css` | `tokens` | Every value: the palette (`--grey-*`, `--blue-*`…), roles (`--color-*`), fonts, text sizes, corners, gradients, shadows. Its comments say what each is for. **The one home for values: never copy them here.** |
| `src/styles/base.css` | `base` | The page, the reset, and the default look of plain elements (the platinum `button`). The only file allowed to style a bare element. |
| `src/styles/kit.css` | `kit` | Shared `mac-…` classes for patterns more than one app uses (toolbar, field, primary button, message, list row). |
| Each app's `<Name>.css`, and the shell's `styles.css` files | none | That app's layout and its deliberate differences, built from tokens. |

`main.tsx` imports the three shared files before `App`, and `tokens.css`
opens with `@layer tokens, base, kit;`. Styles in a layer always lose to
styles in no layer, so **an app's rule beats the shared ones whatever their
specificity**, and nothing needs `!important`.

To see every token, read `tokens.css`. To see where the site still uses raw
values: `node scripts/design-check.mjs --status`.

## 2. The rules

`npm run lint` runs `scripts/design-check.mjs`, which enforces these. Its
header says exactly what each rule matches.

1. **Values come from tokens.** Colours, `font-family`, `font-size` and
   `border-radius` are `var(--…)`. Pick a role (`--color-text`) before a
   palette value (`--grey-20`).
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
2. No role fits? Use the palette value that matches (`--grey-*` by lightness,
   `--blue-*` for Aqua).
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
   `mac-message`, `mac-list-row`, and plain `<button>`s, which are already
   platinum. Write only what's left.
4. `npm run lint`, then check it at 400×300, maximized and on a phone
   (section 4).

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
  that should alter nothing.

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
   `--blue-800` border and `--shadow-raised`. It is in `NasaNews.css`; make
   it a kit class when a second app wants one.
