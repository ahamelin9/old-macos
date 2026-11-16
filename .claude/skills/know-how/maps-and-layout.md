# Know-how: maps and layout

Part of the `know-how` skill. The index is in `SKILL.md`.

## Leaflet throws `_leaflet_pos` after the map closes

*2026-11-09*

- **Symptom:** `TypeError: Cannot read properties of undefined (reading
  '_leaflet_pos')` from `_onZoomTransitionEnd`. It happened when you clicked
  away within about a quarter second of a range map loading.
- **Cause:** an animated zoom finished after the map had been removed.
- **Fix:** `fitBounds` / `setView` with `{ animate: false }` (`RangeMap.tsx`).
- **Check:** in a browser script, jump away right after the map appears.
  `finish()` must report no page errors.

## A map is half grey or the wrong size after a resize or being hidden

*2026-11-09*

- **Symptom:** after maximizing or resizing the Field Guide window, or coming
  Back to a hidden range view, part of the map is grey.
- **Cause:** Leaflet measures its container once. It only hears about
  browser resizes, not about the app window changing or a parent going from
  `hidden` to shown.
- **Fix:** add a `ResizeObserver` on the map's container that calls
  `map.invalidateSize()` when its width is over 0. Both `RangeMap.tsx` and
  `MapPreview.tsx` do this. Use the same pattern for any new map.

## A map stays small when the window is made big

*2026-11-16*

- **Symptom:** Field Guide's maps got wider with the window but stayed
  140px and 230px tall, even maximized.
- **Cause:** their heights were fixed, and nothing inside a scrolling page
  knows the window's height: a percentage has nothing to measure against.
- **Fix:** the window's content box is a size container for Field Guide
  (`.window-content:has(.fieldguide-app) { container-type: size }` in
  `Window/styles.css`), and each map takes a share of it:
  `height: clamp(140px, 38cqh, 460px)`. The floor is the old height, so the
  small window is unchanged. On a phone the preview stays 140px. The
  maps' `ResizeObserver`s already tell Leaflet (the entry above).
- **Check:** maximize Field Guide with the map showing; on a 1400×900
  screen the preview is about 280px tall and its tiles reach every edge.
  An app whose map should fill the window instead is a flex column with
  the map as `flex: 1` (Planes).

## The window's resize handle is hidden behind an app

*2026-11-16*

- **Symptom:** in Planes' Find a Plane, the grey triangle at the window's
  bottom-right corner showed only as two slivers and was hard to grab. Sky
  was fine.
- **Cause:** Find a Plane's page is positioned with a `z-index`, and the
  window's content box is not a stacking context, so the page was stacked
  in the window itself, above the handle. Only the 5px of padding round
  the app stayed clear.
- **Fix:** `isolation: isolate` on the app's root (`.planes-app`), so its
  layers stack inside the app. Any app that uses `z-index` on something
  reaching the bottom-right corner needs the same.
- **Check:** `planes-check.mjs` samples four points along the handle's
  diagonal in a window that isn't maximized (a maximized window has no
  handle). A point 4px in is inside the padding and proves nothing.

## A row of buttons shifts by a pixel when one appears

*2026-11-09*

- **Symptom:** the Search tabs moved down 1px whenever the Back button
  appeared.
- **Cause:** an emoji in the label ("Back to ⚡ Tokyo") made the button 23px
  tall, against the tabs' 21px.
- **Fix:** give the buttons in a row a fixed `height` (`21px` in the Field
  Guide toolbar) and `overflow: hidden`.
- **Check:** measure each button's `getBoundingClientRect().top` with and
  without the new button.

## Every button on the site changed when one app's CSS changed

*2026-11-15*

- **Symptom:** every button on the site was bold with a drop shadow, and the
  window's close, minimize and maximize buttons were 8px apart, not the 6px
  `Window/styles.css` asked for. Removing one app's rule restyled 69 groups
  of buttons in other apps.
- **Cause:** `Calculator.css` had bare `button {…}` and `button:active` rules
  and a `.window-controls` rule. Every stylesheet is global, so they reached
  every button and the window's own controls. The global stylesheet won
  wherever both set a property; only what it didn't set leaked through.
- **Fix:** the site-wide button look, bold and shadows included, is in
  `src/styles/base.css` on purpose now. The Calculator's classes are
  `calculator-…`, and the 8px gap lives in `Window/styles.css`. Since then
  the design check fails on any app selector that doesn't start with the
  app's class (the `design` skill).
- **Check:** `style-diff.mjs` snapshots every button's computed style. Take
  two before the change (they should match), one after, then `--diff`. This
  fix changed 0 of 136 elements.

## Text on a pale chip or box is unreadable in dark mode

*2026-11-15*

- **Symptom:** in dark, Pokémon's ice, ground and fairy badges had pale
  text on their pale type colours, and Field Guide's error box and month
  tooltip had light text on pink and yellow.
- **Cause:** moving the apps onto tokens for dark mode swapped every dark
  text grey for a role, `--color-text-strong`, which turns light in dark.
  The fill behind those (a type colour, `--red-50`, `--yellow-50`) stays
  pale in both themes.
- **Fix:** text on a fill that never changes gets its own palette entry
  from the fixed palette (`--pokemon-type-ink: var(--grey-13)`); a fill
  that has a role uses it (`--color-error-bg`, `--color-tooltip`), so it
  darkens with its text. The rules: the `design` skill, `dark-mode.md`,
  section 3.
- **Check:** `contrast-scan.mjs` (`checking.md`). It only sees what is on
  screen, so hover states and errors need a look by hand.

## A disabled button's text stopped looking greyed

*2026-11-15*

- **Symptom:** after dark mode went in, light screenshots showed System
  Preferences' disabled Show All with black text, where it had been grey.
- **Cause:** `base.css` gained `button { color: … }` so that button text
  turns light in dark. The browser's own greyed text for a disabled button
  is a default too, and any author rule beats it.
- **Fix:** `button:not(:disabled) { color: var(--tone-0); }`. A disabled
  button keeps the browser's grey, which `color-scheme: dark` lightens in
  dark.
- **Check:** `app-shots.mjs` in light compared with a run from before the
  change: System Preferences went back to "same".

## A bar's right end is cut off in the 400px window

*2026-11-15*

- **Symptom:** Music's "Connect to Spotify" button sat past the right edge of
  the window it opens in. Once it fit, the LCD's end time was clipped.
- **Cause:** fixed widths (150px on each side, 15px margins) added up to more
  than 400px. And a range input won't shrink below its built-in width of
  about 130px, even with `flex: 1`.
- **Fix:** a container query on the app's root (`.retro-itunes` has
  `container-type: inline-size`, then `@container (max-width: 620px)`)
  tightens the bar, hides the volume and shortens the button to "Connect".
  `min-width: 0` on the slider lets it shrink.
- **Check:** at 400×300 and maximized, `scrollWidth > clientWidth` on the bar
  is false. Look at both screenshots too.

## The left end of a centred row can't be scrolled to

*2026-11-15*

- **Symptom:** in Pokémon's 400×300 window, Charmander's evolution line was
  cut off on both sides, and scrolling sideways reached only the right end.
  Charmander himself could never be seen.
- **Cause:** `justify-content: center` on a scrolling flex box
  (`.evolution-tree-viewport`). When the row is wider than the box, centring
  pushes its left part past the start edge, and nothing can scroll there.
- **Fix:** drop the centring and give the child `margin-inline: auto`. Auto
  margins centre it when there's room and fall to 0 when there isn't, so an
  overflow goes only to the right. Then make the row fit: a container query
  (`@container pokemon (max-width: 480px)`) shrinks the stage cards, and the
  arrows get `flex-shrink: 1` with `min-width: auto`, so they give up room
  only down to their longest word (a fixed `min-width: 36px` let
  "Friendship" spill out of its pill).
- **Check:** `pokemon-forms-check.mjs` checks `scrollWidth <= clientWidth` on
  Dragonite's, Charizard's and Raichu's lines at every size.

## A CSS-drawn icon is bigger than its box

*2026-11-15*

- **Symptom:** System Preferences' Desktop icon, drawn with `::before`
  and `::after`, had its stand overlapping the screen.
- **Cause:** `base.css` sets `box-sizing: border-box` on `*`, and `*`
  doesn't match pseudo-elements. A `::before` with a border is
  content-box, so its border adds to its height.
- **Fix:** `box-sizing: border-box` on the pseudo-elements themselves
  (`Preferences.css`, `.preferences-icon::before`).
- **Check:** a 2x element shot of the icon (`t.shot(name, selector)`).

## The desktop photo changed by a hair when nothing should have

*2026-11-15*

- **Symptom:** after moving the desktop picture from an inline
  `background-image` into a `--wallpaper-photo` token, `app-shots.mjs
  --compare` showed 0.03% of the desktop changed: thin red lines along the
  photo's sharp edges.
- **Cause:** the token's
  `background` shorthand also set `--color-desktop` as the desktop's own
  background colour. Before, the desktop had none and the page's colour
  showed through. An opaque background changes how Chrome smooths the
  photo's edges.
- **Fix:** leave the colour out of `--wallpaper-photo` and
  `--wallpaper-custom`; `body` already paints `--color-desktop` behind.
- **Check:** `app-shots.mjs` with a made-up app name (`NoApp`) shoots just
  the two desktops; compare with a "before" set: 0 of 2 changed.

